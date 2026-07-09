import type { ArchiveLog } from '../types';
import { tGlobal } from '../i18n/runtime';

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

  if (log.action !== 'archive') return tGlobal('common.notAvailable');
  if ((log.recordsAffected ?? 0) === 0) return tGlobal('common.notAvailable');
  if (log.details?.saveArchive === false) return tGlobal('archive.fileNotSaved');

  return tGlobal('common.notAvailable');
}
