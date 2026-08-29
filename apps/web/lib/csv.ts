// Text cells are quoted and spreadsheet formulas neutralized. Numeric cells
// must be passed as numbers so legitimate negative measurements remain numeric.
export function csvCell(value: string | number) {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value).replace('.', ',') : '';
  const safe = /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvRow(cells: (string | number)[]) {
  return cells.map(csvCell).join(';');
}

// HTTP headers are ASCII/ByteString, while customer identifiers may be Unicode.
export function csvAttachment(filename: string) {
  const safe = filename.replace(/[\x00-\x1f\x7f/\\]/g, '_');
  const fallback = safe.replace(/[^A-Za-z0-9._-]/g, '_');
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
