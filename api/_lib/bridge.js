const DATABASE_SHEETS = [
  'Rumah', 'Penduduk', 'Keluarga', 'RiwayatHunian', 'Pembayaran', 'BukuKas',
  'Tarif', 'Agenda', 'Informasi', 'Pengurus', 'Pengaturan', 'LogAktivitas',
];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variabel Vercel ${name} belum diatur.`);
  return value;
}

export async function callBridge(action, body = {}) {
  const url = new URL(required('APPS_SCRIPT_DATABASE_URL'));
  url.searchParams.set('token', required('APPS_SCRIPT_DATABASE_TOKEN'));
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Google Sheets tidak merespons database bridge.');
  }
  return payload;
}

export { DATABASE_SHEETS };
