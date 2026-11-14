import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { SpreadsheetDatabase } from '../types/database';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
GOOGLE_SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory token cache only (never stored in localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses Google Sheets.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const googleSignOut = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const clearCachedAccessToken = () => {
  cachedAccessToken = null;
};

// ==========================================
// GOOGLE DRIVE & SHEETS API CLIENT
// ==========================================

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetTabMeta {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetTabMeta[];
}

export const SHEET_SCHEMA: Record<keyof SpreadsheetDatabase, string[]> = {
  Rumah: [
    'ID',
    'Blok',
    'Nomor',
    'Alamat',
    'StatusHunian',
    'IDPemilik',
    'IDPenanggungJawabIuran',
    'PihakPembayarIuran',
    'KategoriIuran',
    'Catatan',
    'PINHash',
  ],
  Penduduk: [
    'ID',
    'NIK',
    'NamaLengkap',
    'JenisKelamin',
    'TempatLahir',
    'TanggalLahir',
    'NoHP',
    'Pekerjaan',
    'StatusPenduduk',
    'StatusData',
  ],
  Keluarga: [
    'ID',
    'IDRumah',
    'IDPenduduk',
    'IDKepalaKeluarga',
    'HubunganKeluarga',
    'Peran',
    'StatusMenghuni',
  ],
  RiwayatHunian: [
    'ID',
    'IDRumah',
    'IDKepalaKeluarga',
    'NamaKeluarga',
    'JenisHunian',
    'TanggalMulai',
    'TanggalSelesai',
    'StatusHunian',
    'Catatan',
  ],
  Pembayaran: [
    'ID',
    'AlamatRumah',
    'JenisIuran',
    'TipeIuran',
    'Periode',
    'Tahun',
    'Bulan',
    'Nominal',
    'TanggalBayar',
    'MetodeBayar',
    'BuktiURL',
    'KodeTransaksi',
    'Status',
    'PihakPembayar',
    'CatatanVerifikator',
    'DiverifikasiOleh',
    'TanggalVerifikasi',
  ],
  BukuKas: [
    'ID',
    'Tanggal',
    'Jenis',
    'Kategori',
    'Uraian',
    'Nominal',
    'SumberReferensi',
    'DicatatOleh',
  ],
  Tarif: ['ID', 'JenisIuran', 'TipeIuran', 'KategoriIuran', 'Nominal', 'Status'],
  Agenda: ['ID', 'Judul', 'Tanggal', 'Waktu', 'Lokasi', 'Deskripsi', 'Status', 'DibuatOleh'],
  Informasi: ['ID', 'Judul', 'Isi', 'Kategori', 'TanggalTerbit', 'Status', 'DibuatOleh'],
  Pengurus: ['ID', 'Nama', 'Username', 'PasswordHash', 'Jabatan', 'Role', 'Status', 'DibuatPada'],
  Pengaturan: ['Kunci', 'Nilai'],
  LogAktivitas: ['Waktu', 'User', 'Aksi', 'Detail'],
};

const NUMERIC_COLUMNS = new Set(['Tahun', 'Bulan', 'Nominal']);

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

async function googleFetch(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('Sesi Google Anda telah berakhir. Silakan Sign in with Google kembali.');
  }

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      if (json?.error?.message) errMsg = json.error.message;
    } catch {
      // ignore json parse failure
    }
    throw new Error(errMsg);
  }

  return res.json();
}

export async function listGoogleSpreadsheets(
  token: string,
  searchQuery = ''
): Promise<DriveSpreadsheetFile[]> {
  const qParts = ["mimeType='application/vnd.google-spreadsheet'", 'trashed=false'];
  const cleanSearch = searchQuery.trim().replace(/'/g, "\\'");
  if (cleanSearch) {
    qParts.push(`name contains '${cleanSearch}'`);
  }
  const params = new URLSearchParams({
    q: qParts.join(' and '),
    orderBy: 'modifiedTime desc',
    pageSize: '25',
    fields: 'files(id,name,modifiedTime,webViewLink)',
  });

  const data = await googleFetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, token);
  return (data.files || []) as DriveSpreadsheetFile[];
}

export async function getSpreadsheetMetadata(
  token: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const fields = 'spreadsheetId,properties.title,spreadsheetUrl,sheets.properties(sheetId,title,gridProperties)';
  const data = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanId)}?fields=${encodeURIComponent(fields)}`,
    token
  );

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Tanpa Judul',
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    sheets: (data.sheets || []).map(
      (s: { properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }) => ({
        sheetId: s.properties?.sheetId ?? 0,
        title: s.properties?.title ?? 'Sheet',
        rowCount: s.properties?.gridProperties?.rowCount ?? 0,
        columnCount: s.properties?.gridProperties?.columnCount ?? 0,
      })
    ),
  };
}

export async function readSheetValues(
  token: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<string[][]> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const range = encodeURIComponent(`${quoteSheetTitle(sheetTitle)}!A:Z`);
  const data = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanId)}/values/${range}`,
    token
  );
  return (data.values || []) as string[][];
}

function serializeSheetRows(
  sheetName: keyof SpreadsheetDatabase,
  db: SpreadsheetDatabase
): (string | number)[][] {
  const headers = SHEET_SCHEMA[sheetName];
  const rows = (db[sheetName] || []) as unknown as Record<string, unknown>[];

  const dataRows = rows.map((row) =>
    headers.map((col) => {
      const raw = row[col];
      if (raw === null || raw === undefined) return '';
      if (NUMERIC_COLUMNS.has(col)) {
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
      }
      const str = String(raw);
      // Google Sheets rejects single cell values > 50,000 characters
      if (str.length > 49500) {
        return '[Lampiran terlalu besar untuk sel Google Sheets]';
      }
      return str;
    })
  );

  return [headers, ...dataRows];
}

export async function createRT07Spreadsheet(
  token: string,
  title: string,
  db: SpreadsheetDatabase
): Promise<SpreadsheetMetadata> {
  const sheetNames = Object.keys(SHEET_SCHEMA) as (keyof SpreadsheetDatabase)[];
  const created = await googleFetch('https://sheets.googleapis.com/v4/spreadsheets', token, {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        title: title.trim() || 'Database RT 07 GO DIGITAL',
        timeZone: 'Asia/Jakarta',
      },
      sheets: sheetNames.map((name, idx) => ({
        properties: {
          title: name,
          index: idx,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      })),
    }),
  });

  const meta: SpreadsheetMetadata = {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title || title,
    spreadsheetUrl:
      created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    sheets: (created.sheets || []).map(
      (s: { properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }) => ({
        sheetId: s.properties?.sheetId ?? 0,
        title: s.properties?.title ?? 'Sheet',
        rowCount: s.properties?.gridProperties?.rowCount ?? 1000,
        columnCount: s.properties?.gridProperties?.columnCount ?? 26,
      })
    ),
  };

  await pushDatabaseToSpreadsheet(token, meta.spreadsheetId, db);
  return meta;
}

export async function pushDatabaseToSpreadsheet(
  token: string,
  spreadsheetId: string,
  db: SpreadsheetDatabase
): Promise<{ updatedSheets: string[]; totalRows: number }> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const meta = await getSpreadsheetMetadata(token, cleanId);
  const existingTitles = new Map(meta.sheets.map((s) => [s.title.toLowerCase(), s.title]));

  const canonicalNames = Object.keys(SHEET_SCHEMA) as (keyof SpreadsheetDatabase)[];
  const missingNames = canonicalNames.filter((name) => !existingTitles.has(name.toLowerCase()));

  if (missingNames.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanId)}:batchUpdate`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missingNames.map((name) => ({
            addSheet: {
              properties: {
                title: name,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          })),
        }),
      }
    );
    missingNames.forEach((name) => existingTitles.set(name.toLowerCase(), name));
  }

  const targetRanges = canonicalNames.map((name) => {
    const actualTitle = existingTitles.get(name.toLowerCase()) || name;
    return `${quoteSheetTitle(actualTitle)}!A:Z`;
  });

  // Clear existing data so removed rows do not remain stale
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanId)}/values:batchClear`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ ranges: targetRanges }),
    }
  );

  let totalRows = 0;
  const updatedSheets: string[] = [];
  const dataPayload = canonicalNames.map((name) => {
    const actualTitle = existingTitles.get(name.toLowerCase()) || name;
    const values = serializeSheetRows(name, db);
    totalRows += Math.max(0, values.length - 1);
    updatedSheets.push(actualTitle);
    return {
      range: `${quoteSheetTitle(actualTitle)}!A1`,
      majorDimension: 'ROWS',
      values,
    };
  });

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanId)}/values:batchUpdate`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: dataPayload,
      }),
    }
  );

  return { updatedSheets, totalRows };
}

export async function pullDatabaseFromSpreadsheet(
  token: string,
  spreadsheetId: string
): Promise<{
  metadata: SpreadsheetMetadata;
  data: Partial<SpreadsheetDatabase>;
  tabCounts: { sheet: keyof SpreadsheetDatabase; actualTitle: string; count: number }[];
  unmatchedTabs: string[];
}> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const metadata = await getSpreadsheetMetadata(token, cleanId);
  const canonicalKeys = Object.keys(SHEET_SCHEMA) as (keyof SpreadsheetDatabase)[];
  const canonicalByLower = new Map(canonicalKeys.map((k) => [k.toLowerCase(), k]));

  const matchedTabs: { canonical: keyof SpreadsheetDatabase; actualTitle: string }[] = [];
  const unmatchedTabs: string[] = [];

  metadata.sheets.forEach((s) => {
    const match = canonicalByLower.get(s.title.toLowerCase());
    if (match) {
      matchedTabs.push({ canonical: match, actualTitle: s.title });
    } else {
      unmatchedTabs.push(s.title);
    }
  });

  const imported: Partial<SpreadsheetDatabase> = {};
  const tabCounts: { sheet: keyof SpreadsheetDatabase; actualTitle: string; count: number }[] = [];

  if (matchedTabs.length > 0) {
    const params = new URLSearchParams();
    matchedTabs.forEach((t) => {
      params.append('ranges', `${quoteSheetTitle(t.actualTitle)}!A:Z`);
    });

    const batchRes = await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanId)}/values:batchGet?${params.toString()}`,
      token
    );

    const valueRanges = (batchRes.valueRanges || []) as { values?: string[][] }[];

    matchedTabs.forEach((tab, index) => {
      const grid = valueRanges[index]?.values || [];
      if (grid.length <= 1) {
        (imported as Record<string, unknown[]>)[tab.canonical] = [];
        tabCounts.push({ sheet: tab.canonical, actualTitle: tab.actualTitle, count: 0 });
        return;
      }

      const headers = grid[0].map((h) => String(h || '').trim());
      const rows = grid.slice(1).filter((r) => r.some((cell) => String(cell ?? '').trim() !== ''));

      const parsedRows = rows.map((row) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, colIdx) => {
          if (!h) return;
          const rawVal = row[colIdx] ?? '';
          if (NUMERIC_COLUMNS.has(h)) {
            const num = Number(String(rawVal).replace(/[^0-9.-]/g, ''));
            obj[h] = Number.isFinite(num) ? num : 0;
          } else {
            obj[h] = String(rawVal);
          }
        });
        return obj;
      });

      (imported as Record<string, unknown[]>)[tab.canonical] = parsedRows;
      tabCounts.push({ sheet: tab.canonical, actualTitle: tab.actualTitle, count: parsedRows.length });
    });
  }

  return {
    metadata,
    data: imported,
    tabCounts,
    unmatchedTabs,
  };
}
