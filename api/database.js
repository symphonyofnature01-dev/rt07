import { callBridge, DATABASE_SHEETS } from './_lib/bridge.js';
import { clearSession, getSession } from './_lib/session.js';

function send(res, status, body) { res.status(status).json(body); }

export function requiresCurrentDatabase(session) {
  return session.role === 'Warga';
}

function authorizedChanges(session, changes, currentDatabase) {
  if (session.role === 'Admin') return changes;
  if (session.role === 'Ketua' || session.role === 'Sekretaris') {
    return changes.filter((change) => !['Pengurus', 'Pengaturan', 'Pembayaran', 'BukuKas', 'Tarif'].includes(change.sheet));
  }
  if (session.role === 'Bendahara') {
    return changes.filter((change) => ['Pembayaran', 'BukuKas', 'Tarif', 'LogAktivitas'].includes(change.sheet));
  }
  if (session.role === 'Warga') {
    return changes.filter((change) => change.sheet === 'Pembayaran').map((change) => ({
      ...change,
      deletes: [],
      upserts: (change.upserts || []).filter((row) =>
        row.AlamatRumah === session.alamat &&
        row.Status === 'Menunggu Verifikasi' &&
        !currentDatabase.Pembayaran.some((existing) => existing.ID === row.ID)
      ),
    }));
  }
  return [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Metode tidak didukung.' });
  const session = getSession(req);
  if (!session) return send(res, 401, { error: 'Sesi tidak tersedia. Silakan login kembali.' });
  const changes = Array.isArray(req.body?.changes) ? req.body.changes.filter((change) => DATABASE_SHEETS.includes(change.sheet)) : [];
  try {
    const current = requiresCurrentDatabase(session) ? await callBridge('read') : null;
    if (current && Number(req.body?.expectedRevision) !== Number(current.revision)) {
      return send(res, 409, { error: 'Data telah diubah pengguna lain. Muat ulang halaman sebelum menyimpan kembali.' });
    }
    const allowed = authorizedChanges(session, changes, current?.database).filter((change) => change.upserts?.length || change.deletes?.length);
    if (!allowed.length) return send(res, 403, { error: 'Perubahan ini tidak diizinkan untuk peran Anda.' });
    const result = await callBridge('patch', { changes: allowed, expectedRevision: req.body?.expectedRevision, sessionVersion: session.sessionVersion });
    return send(res, 200, { ok: true, revision: result.revision });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Data gagal disimpan ke Spreadsheet.';
    if (message.startsWith('SESSION_EXPIRED:')) {
      clearSession(res);
      return send(res, 401, { error: message.replace(/^SESSION_EXPIRED:\s*/, '') });
    }
    return send(res, message.startsWith('CONFLICT:') ? 409 : 503, { error: message.replace(/^CONFLICT:\s*/, '') });
  }
}
