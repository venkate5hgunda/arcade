import manifest from '../../../docs/redesign/artwork-manifest.json';
export const artwork = new Map(
  manifest.assets.map((asset) => [asset.id, asset]),
);
/** One manifest-backed asset per game across every catalog and setup surface. */
export function GameArt({
  id,
  className = '',
  decorative = false,
  eager = false,
}: {
  id: string;
  className?: string;
  decorative?: boolean;
  eager?: boolean;
}) {
  const asset = artwork.get(id);
  if (!asset) throw new RangeError(`No custom artwork registered for ${id}.`);
  return (
    <img
      className={`game-artwork ${className}`}
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt={decorative ? '' : asset.alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
    />
  );
}
