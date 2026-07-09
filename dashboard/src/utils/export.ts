import { tGlobal } from '../i18n/runtime';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string;
}

export function exportToCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  if (rows.length === 0) return;

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = columns.map((c) => escape(c.header)).join(';');
  const lines = rows.map((row) => columns.map((c) => escape(c.value(row))).join(';'));
  const blob = new Blob([`\uFEFF${header}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function createExportBulkAction<T>(
  filename: string,
  columns: CsvColumn<T>[]
): {
  id: string;
  label: string;
  onAction: (rows: T[], ids: string[]) => void;
} {
  return {
    id: 'export-csv',
    label: tGlobal('export.csvLabel'),
    onAction: (rows) => exportToCsv(filename, rows, columns),
  };
}
