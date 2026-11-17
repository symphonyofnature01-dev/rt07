import type { PublicInfo, SpreadsheetDatabase, UserSession } from '../types/database';

export type SheetName = keyof SpreadsheetDatabase;

export interface SheetPatch {
  sheet: SheetName;
  upserts: Record<string, unknown>[];
  deletes: string[];
}

export interface DatabasePatch {
  changes: SheetPatch[];
}

interface AuthResponse {
  ok: true;
  session: UserSession;
  database: SpreadsheetDatabase;
  revision: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const payload = await response.json().catch(() => null) as { error?: unknown } | T | null;
  if (!response.ok) {
    throw new Error(payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : 'Database pusat tidak dapat diakses.');
  }
  return payload as T;
}

export function getRemotePublicInfo(): Promise<PublicInfo> {
  return request<PublicInfo>('/api/auth?mode=public');
}

export function loginRemotePengurus(username: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'pengurus', username, password }),
  });
}

export function loginRemoteWarga(alamat: string, pin: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'warga', alamat, pin }),
  });
}

export function restoreRemoteSession(): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth');
}

export async function logoutRemoteSession(): Promise<void> {
  await request<{ ok: true }>('/api/auth', { method: 'DELETE' });
}

export async function applyRemotePatch(patch: DatabasePatch, expectedRevision: number): Promise<number> {
  if (!patch.changes.length) return expectedRevision;
  const response = await request<{ ok: true; revision: number }>('/api/database', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...patch, expectedRevision }),
  });
  return response.revision;
}

const SHEETS: SheetName[] = [
  'Rumah', 'Penduduk', 'Keluarga', 'RiwayatHunian', 'Pembayaran', 'BukuKas',
  'Tarif', 'Agenda', 'Informasi', 'Pengurus', 'Pengaturan', 'LogAktivitas',
];

function rowKey(sheet: SheetName, row: Record<string, unknown>): string {
  if (sheet === 'Pengaturan') return String(row.Kunci || '');
  if (sheet === 'LogAktivitas') return [row.Waktu, row.User, row.Aksi, row.Detail].map(String).join('\u001f');
  return String(row.ID || '');
}

function equalRow(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createDatabasePatch(before: SpreadsheetDatabase, after: SpreadsheetDatabase): DatabasePatch {
  const changes: SheetPatch[] = [];
  for (const sheet of SHEETS) {
    const previous = new Map((before[sheet] as unknown as Record<string, unknown>[]).map((row) => [rowKey(sheet, row), row]));
    const next = new Map((after[sheet] as unknown as Record<string, unknown>[]).map((row) => [rowKey(sheet, row), row]));
    const upserts = [...next.entries()]
      .filter(([key, row]) => key && (!previous.has(key) || !equalRow(previous.get(key)!, row)))
      .map(([, row]) => row);
    const deletes = [...previous.keys()].filter((key) => key && !next.has(key));
    if (upserts.length || deletes.length) changes.push({ sheet, upserts, deletes });
  }
  return { changes };
}
