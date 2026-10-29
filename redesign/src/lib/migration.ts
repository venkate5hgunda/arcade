import { KEYS, protectStorage, reportFailure, saveJSON } from './storage.ts';
export const STORAGE_VERSION = 1;
const PREFIX = 'arcade:';
const LEGACY = [
  KEYS.THEME,
  KEYS.SOUND_ENABLED,
  KEYS.HAPTICS_ENABLED,
  KEYS.ACTIVE_GAME,
  KEYS.GAME_SESSIONS,
  KEYS.RECENT_GAMES,
  KEYS.PLAYER_NAMES,
  KEYS.HIGH_SCORES,
  KEYS.SETTINGS,
];
const known = (key: string) =>
  key.startsWith(PREFIX) &&
  (LEGACY.includes(key.slice(PREFIX.length) as (typeof LEGACY)[number]) ||
    key.startsWith(PREFIX + KEYS.SETTINGS + ':') ||
    key.startsWith(PREFIX + KEYS.HIGH_SCORES + ':'));
export interface StorageBackup {
  version: 0;
  createdAt: number;
  values: Record<string, string>;
}
export function savedValues(): Record<string, string> {
  const values: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !known(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return values;
}
export function validBackup(value: unknown): value is StorageBackup {
  const backup = value as StorageBackup;
  return (
    !!backup &&
    Object.keys(backup).sort().join() === 'createdAt,values,version' &&
    backup.version === 0 &&
    Number.isSafeInteger(backup.createdAt) &&
    backup.createdAt >= 0 &&
    !!backup.values &&
    typeof backup.values === 'object' &&
    !Array.isArray(backup.values) &&
    Object.entries(backup.values).every(
      ([key, value]) => known(key) && typeof value === 'string',
    )
  );
}
/** Version 1 preserves every legacy value verbatim; the backup precedes the marker. */
export function migrateStorage(): 'current' | 'migrated' | 'protected' {
  protectStorage(null);
  try {
    const raw = localStorage.getItem(PREFIX + KEYS.STORAGE_VERSION);
    const version = raw === null ? 0 : JSON.parse(raw);
    if (
      !Number.isSafeInteger(version) ||
      version < 0 ||
      version > STORAGE_VERSION
    ) {
      protectStorage(
        'Saved data belongs to an unsupported Arcade version. Existing data is protected; reload the latest app before saving.',
      );
      reportFailure(
        'version',
        KEYS.STORAGE_VERSION,
        new Error('Unsupported saved-data version.'),
      );
      return 'protected';
    }
    if (version === STORAGE_VERSION) return 'current';
    const old = localStorage.getItem(PREFIX + KEYS.LEGACY_BACKUP);
    if (old !== null) {
      if (!validBackup(JSON.parse(old))) throw Error('Invalid legacy backup.');
    } else if (
      !saveJSON(KEYS.LEGACY_BACKUP, {
        version: 0,
        createdAt: Date.now(),
        values: savedValues(),
      } satisfies StorageBackup)
    )
      throw Error('Backup unavailable.');
    if (
      !validBackup(
        JSON.parse(localStorage.getItem(PREFIX + KEYS.LEGACY_BACKUP) ?? 'null'),
      )
    )
      throw Error('Backup verification failed.');
    if (!saveJSON(KEYS.STORAGE_VERSION, STORAGE_VERSION))
      throw Error('Migration marker unavailable.');
    return 'migrated';
  } catch {
    protectStorage(
      'Saved-game migration could not finish. Existing data is protected; keep this tab open and retry when browser storage is available.',
    );
    reportFailure(
      'migration',
      KEYS.STORAGE_VERSION,
      new Error('Saved-data migration unavailable.'),
    );
    return 'protected';
  }
}
export function downloadSavedGames() {
  const contents = JSON.stringify(
    { version: STORAGE_VERSION, exportedAt: Date.now(), values: savedValues() },
    null,
    2,
  );
  const url = URL.createObjectURL(
    new Blob([contents], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'arcade-saved-games.json';
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
