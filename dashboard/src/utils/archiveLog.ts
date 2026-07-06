import type { ArchiveLog } from '../types';

/** Имя файла архива из записи журнала (верхний уровень или details). */
export function resolveArchiveFilename(log: ArchiveLog): string | undefined {
  const direct = log.filename?.trim();
  if (direct) return direct;

  const nested = log.details?.filename;
  if (typeof nested === 'string' && nested.trim()) return nested.trim();

  return undefined;
}

export function archiveFilenameLabel(log: ArchiveLog): string {
  const filename = resolveArchiveFilename(log);
  if (filename) return filename;

  if (log.action !== 'archive') return '—';
  if ((log.recordsAffected ?? 0) === 0) return '—';
  if (log.details?.saveArchive === false) return 'не сохранялся';

  return '—';
}
