"""Deterministic, lossless year-partitioned JSONL exports for the movie catalog.

Partition actual serialized UTF-8 byte sizes into naturally aligned decade
windows, shrinking crowded periods into allowed widths (5, 2, 1 years) and
writing deterministic numbered parts for single years or undated records
that exceed target size. An index.json catalog index is published last,
maintaining atomic replacement and safe stale artifact cleanup.
"""

import hashlib
import json
import os
from pathlib import Path
import time

try:
    from .catalog import dump
except ImportError:
    try:
        from dev.movies.catalog import dump
    except ImportError:
        def dump(value):
            return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _partition_items_to_parts(start_year, end_year, items, max_bytes, prefix):
    """
    Partitions items exceeding max_bytes into deterministic numbered parts.
    Individual records exceeding max_bytes are placed alone with oversize=True.
    """
    chunks = []
    current_chunk = []
    current_bytes = 0

    for item in items:
        _, _, byte_len = item
        if byte_len > max_bytes:
            if current_chunk:
                chunks.append((current_chunk, False))
                current_chunk = []
                current_bytes = 0
            chunks.append(([item], True))
        elif current_bytes + byte_len <= max_bytes:
            current_chunk.append(item)
            current_bytes += byte_len
        else:
            chunks.append((current_chunk, False))
            current_chunk = [item]
            current_bytes = byte_len

    if current_chunk:
        chunks.append((current_chunk, False))

    pad = max(2, len(str(len(chunks))))
    for idx, (chunk_items, is_oversize) in enumerate(chunks, 1):
        stem = f"{prefix}.part{idx:0{pad}d}"
        yield (stem, start_year, end_year, chunk_items, is_oversize)


def _partition_period(start_year, end_year, items_by_year, max_bytes):
    """
    Recursively partitions an inclusive year range [start_year, end_year]
    into allowed widths (10, 5, 2, 1). Crowded 5-year periods split into 2+2+1.
    """
    period_items = []
    for y in range(start_year, end_year + 1):
        if y in items_by_year:
            period_items.extend(items_by_year[y])

    if not period_items:
        return

    total_bytes = sum(item[2] for item in period_items)
    width = end_year - start_year + 1

    if total_bytes <= max_bytes:
        stem = f"{start_year}-{end_year}" if width > 1 else f"{start_year}"
        yield (stem, start_year, end_year, period_items, False)
        return

    if width == 10:
        yield from _partition_period(start_year, start_year + 4, items_by_year, max_bytes)
        yield from _partition_period(start_year + 5, end_year, items_by_year, max_bytes)
    elif width == 5:
        # 5-year crowded period splits into 2+2+1 subranges
        yield from _partition_period(start_year, start_year + 1, items_by_year, max_bytes)
        yield from _partition_period(start_year + 2, start_year + 3, items_by_year, max_bytes)
        yield from _partition_period(start_year + 4, start_year + 4, items_by_year, max_bytes)
    elif width == 2:
        yield from _partition_period(start_year, start_year, items_by_year, max_bytes)
        yield from _partition_period(end_year, end_year, items_by_year, max_bytes)
    elif width == 1:
        yield from _partition_items_to_parts(start_year, start_year, period_items, max_bytes, prefix=str(start_year))


def write_partitions(records, directory, max_bytes=8 * 1024 * 1024):
    """
    Export movie records into lossless, size-aware year-partitioned JSONL files.

    Records are grouped into naturally aligned 10-year windows, shrinking crowded
    windows into allowed widths 5, 2, 1 years (5-year crowded windows split into
    2+2+1). Single years and undated records exceeding max_bytes are partitioned
    into numbered parts. Single records exceeding max_bytes are placed alone with
    oversize=True.

    Partition files use immutable content-addressed generation filenames
    (<stem>.<sha256[:12]>.jsonl) so an index publication failure leaves previous
    generations fully intact. Writes index.json last and returns the index dict.
    """
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)

    dated_records = {}
    undated_records = []
    total_records = 0

    for record in records:
        line_str = dump(record) + "\n"
        line_bytes = line_str.encode("utf-8")
        byte_len = len(line_bytes)
        item = (record, line_bytes, byte_len)
        total_records += 1

        year = record.get("year")
        if isinstance(year, int) and not isinstance(year, bool):
            dated_records.setdefault(year, []).append(item)
        else:
            undated_records.append(item)

    partition_chunks = []

    # Process dated records decade by decade
    decades = sorted({(y // 10) * 10 for y in dated_records.keys()})
    for decade in decades:
        partition_chunks.extend(_partition_period(decade, decade + 9, dated_records, max_bytes))

    # Process undated records
    if undated_records:
        undated_bytes = sum(item[2] for item in undated_records)
        if undated_bytes <= max_bytes:
            partition_chunks.append(("undated", None, None, undated_records, False))
        else:
            partition_chunks.extend(_partition_items_to_parts(None, None, undated_records, max_bytes, prefix="undated"))

    # Compute content hashes and immutable filenames
    file_specs = []
    for stem, start_year, end_year, chunk_items, is_oversize in partition_chunks:
        hasher = hashlib.sha256()
        chunk_total_bytes = 0
        for item in chunk_items:
            raw_bytes = item[1]
            hasher.update(raw_bytes)
            chunk_total_bytes += len(raw_bytes)
        digest = hasher.hexdigest()
        filename = f"{stem}.{digest[:12]}.jsonl"
        file_specs.append((stem, filename, start_year, end_year, chunk_items, chunk_total_bytes, digest, is_oversize))

    # Sort file specs deterministically
    def _sort_key(spec):
        stem, filename, start_year, end_year, _, _, _, _ = spec
        is_undated = 1 if start_year is None else 0
        s_yr = start_year if start_year is not None else 0
        e_yr = end_year if end_year is not None else 0
        return (is_undated, s_yr, e_yr, stem, filename)

    file_specs.sort(key=_sort_key)

    token = f"{os.getpid()}_{time.time_ns()}"
    staged_files = []
    newly_published = []
    files_index = []

    try:
        for stem, filename, start_year, end_year, chunk_items, chunk_bytes, digest, is_oversize in file_specs:
            target_path = directory / filename
            stage_path = directory / f".{filename}.stage_{token}"

            with stage_path.open("wb") as out:
                for item in chunk_items:
                    out.write(item[1])

            staged_files.append((stage_path, target_path))
            files_index.append({
                "path": filename,
                "start_year": start_year,
                "end_year": end_year,
                "records": len(chunk_items),
                "bytes": chunk_bytes,
                "sha256": digest,
                "oversize": is_oversize,
            })

        # Read previous index for safe stale cleanup
        index_path = directory / "index.json"
        prev_files = set()
        if index_path.is_file():
            try:
                prev_data = json.loads(index_path.read_text(encoding="utf-8"))
                if isinstance(prev_data, dict) and "files" in prev_data:
                    for f_info in prev_data["files"]:
                        if isinstance(f_info, dict) and "path" in f_info:
                            prev_files.add(f_info["path"])
            except Exception:
                pass

        # Publish all partition files
        for stage_path, target_path in staged_files:
            stage_path.replace(target_path)
            newly_published.append(target_path)

        # Build final index
        index_dict = {
            "format_version": 1,
            "max_bytes": max_bytes,
            "records": total_records,
            "files": files_index,
        }

        # Write index.json last
        index_stage = directory / f".index.json.stage_{token}"
        index_stage.write_text(json.dumps(index_dict, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        index_stage.replace(index_path)

        # Cleanup obsolete artifacts that are in prev_index but not in current index
        new_paths = {f_info["path"] for f_info in files_index}
        stale_paths = prev_files - new_paths
        for stale in stale_paths:
            stale_file = directory / stale
            if stale_file.is_file():
                try:
                    stale_file.unlink(missing_ok=True)
                except OSError:
                    pass

        return index_dict

    except Exception:
        for stage_path, _ in staged_files:
            if stage_path.exists():
                try:
                    stage_path.unlink(missing_ok=True)
                except OSError:
                    pass
        index_stage = directory / f".index.json.stage_{token}"
        if index_stage.exists():
            try:
                index_stage.unlink(missing_ok=True)
            except OSError:
                pass
        # If index publication failed, remove any newly published files not belonging to previous index
        for pub_path in newly_published:
            if pub_path.name not in prev_files:
                try:
                    pub_path.unlink(missing_ok=True)
                except OSError:
                    pass
        raise
