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

export function resolveArchiveScanned(log: ArchiveLog): number | undefined {
  const raw = log.details?.scanned;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return undefined;
}

type ArchiveTranslate = (key: string, params?: Record<string, string | number>) => string;

export function formatArchiveRecordsCell(log: ArchiveLog, t: ArchiveTranslate): string {
  const affected = log.recordsAffected ?? 0;
  if (affected > 0) return String(affected);

  const scanned = resolveArchiveScanned(log);
  if (typeof scanned === 'number' && scanned > 0) {
    return t('pages.archive.records.checkedNone', { scanned });
  }

  return t('pages.archive.records.none');
}

export function resolveArchiveLogStatus(log: ArchiveLog, t: ArchiveTranslate): string {
  if (log.details?.error) {
    return t('pages.archive.status.failed');
  }
  if ((log.recordsAffected ?? 0) > 0) {
    return t('pages.archive.status.processed');
  }
  return t('pages.archive.status.empty');
}

export function archiveFilenameLabel(log: ArchiveLog): string {
  const filename = resolveArchiveFilename(log);
  if (filename) return filename;

  if (log.action !== 'archive') return tGlobal('common.notAvailable');
  if ((log.recordsAffected ?? 0) === 0) return tGlobal('common.notAvailable');
  if (log.details?.saveArchive === false) return tGlobal('archive.fileNotSaved');

  return tGlobal('common.notAvailable');
}
