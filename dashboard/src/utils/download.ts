import { fetchWithAuth } from '../api/client';

async function downloadResponse(res: Response, filename: string): Promise<void> {
  if (!res.ok) {
    throw new Error(`Ошибка загрузки (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadBackupFile(filename: string): Promise<void> {
  const res = await fetchWithAuth(`/api/crm/backup-files/backups/${encodeURIComponent(filename)}`);
  await downloadResponse(res, filename);
}

export async function deleteBackupFile(filename: string): Promise<void> {
  const res = await fetchWithAuth(`/api/crm/backup-files/backups/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
  if (res.status !== 204 && res.status !== 404) {
    throw new Error(`Не удалось удалить файл (${res.status})`);
  }
}

export async function downloadArchiveFile(filename: string): Promise<void> {
  const res = await fetchWithAuth(`/api/crm/backup-files/archives/${encodeURIComponent(filename)}`);
  await downloadResponse(res, filename);
}

export async function deleteArchiveFile(filename: string): Promise<void> {
  const res = await fetchWithAuth(`/api/crm/backup-files/archives/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
  if (res.status !== 204 && res.status !== 404) {
    throw new Error(`Не удалось удалить архив (${res.status})`);
  }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
