import type { PendudukRow, SpreadsheetDatabase } from '../types/database';

type LegacyPendudukRow = PendudukRow & { NIK?: unknown };

export function removeNikFromPenduduk(rows: PendudukRow[]): PendudukRow[] {
  return rows.map((row) => {
    const { NIK: _nik, ...withoutNik } = row as LegacyPendudukRow;
    return withoutNik;
  });
}

export function removeNikFromDatabase(database: SpreadsheetDatabase): SpreadsheetDatabase {
  return { ...database, Penduduk: removeNikFromPenduduk(database.Penduduk) };
}
