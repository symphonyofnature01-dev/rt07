import { callBridge } from './_lib/bridge.js';
import { clearSession, getSession, setSession } from './_lib/session.js';
import crypto from 'node:crypto';

function send(res, status, body) {
  res.status(status).json(body);
}

function hashWithSalt(password, salt) {
  let hash = 0;
  for (const char of `${salt}${password}`) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(16);
}

function same(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  if (!stored.includes('$')) return same(password, stored);
  const [salt, expected] = stored.split('$');
  return same(hashWithSalt(password, salt), expected);
}

function permissions(role) {
  return {
    pengurus: role !== 'Warga',
    ubahData: ['Admin', 'Ketua', 'Sekretaris'].includes(role),
    ubahKeuangan: ['Admin', 'Ketua', 'Bendahara'].includes(role),
    admin: role === 'Admin',
  };
}

function publicInfo(database) {
  const settings = Object.fromEntries(database.Pengaturan.map((row) => [row.Kunci, row.Nilai]));
  return {
    namaAplikasi: settings.NamaAplikasi || 'RT 07 GO DIGITAL',
    namaRT: settings.NamaRT || 'RT 07',
    alamatRT: settings.AlamatRT || '',
    pinWargaAktif: settings.PinWargaAktif === 'YA',
    daftarAlamat: database.Rumah.map((row) => row.Alamat).sort(),
  };
}

function wargaDatabase(database, alamat) {
  const rumah = database.Rumah.filter((row) => row.Alamat === alamat);
  const rumahIds = new Set(rumah.map((row) => row.ID));
  const keluarga = database.Keluarga.filter((row) => rumahIds.has(row.IDRumah));
  const pendudukIds = new Set(keluarga.map((row) => row.IDPenduduk));
  return {
    ...database,
    Penduduk: database.Penduduk.filter((row) => pendudukIds.has(row.ID)),
    Keluarga: keluarga,
    RiwayatHunian: database.RiwayatHunian.filter((row) => rumahIds.has(row.IDRumah)),
    Pembayaran: database.Pembayaran.filter((row) => row.AlamatRumah === alamat),
    BukuKas: [],
    Pengurus: [],
    LogAktivitas: [],
    Rumah: rumah.map(({ PINHash, ...row }) => row),
    Pengaturan: database.Pengaturan.filter((row) => ['NamaAplikasi', 'NamaRT', 'AlamatRT', 'PinWargaAktif', 'RekeningBank', 'RekeningNomor', 'RekeningAtasNama', 'MulaiIuran', 'NominalIuranRutin', 'NominalIuranNonRutin'].includes(row.Kunci)),
  };
}

function databaseForSession(database, session) {
  if (session.type === 'warga') return wargaDatabase(database, session.alamat);
  if (session.role === 'Admin') return database;
  return {
    ...database,
    Rumah: database.Rumah.map(({ PINHash, ...row }) => row),
    Pengurus: database.Pengurus.map(({ PasswordHash, ...row }) => row),
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'DELETE') {
      clearSession(res);
      return send(res, 200, { ok: true });
    }

    const bridge = await callBridge('read');
    const database = bridge.database;

    if (req.method === 'GET' && req.query.mode === 'public') return send(res, 200, publicInfo(database));
    if (req.method === 'GET') {
      const session = getSession(req);
      if (!session) return send(res, 401, { error: 'Sesi tidak tersedia. Silakan login kembali.' });
      const settings = Object.fromEntries(database.Pengaturan.map((row) => [row.Kunci, row.Nilai]));
      if (session.sessionVersion !== (settings.SesiVersi || '1')) {
        clearSession(res);
        return send(res, 401, { error: 'Sesi telah berakhir. Silakan login kembali.' });
      }
      return send(res, 200, { ok: true, session, database: databaseForSession(database, session), revision: bridge.revision });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Metode tidak didukung.' });

    const body = req.body || {};
    let session;
    if (body.type === 'pengurus') {
      const user = database.Pengurus.find((row) => row.Username?.trim().toLowerCase() === String(body.username || '').trim().toLowerCase());
      if (!user || user.Status !== 'Aktif' || !verifyPassword(String(body.password || ''), user.PasswordHash)) {
        return send(res, 401, { error: 'Username atau password salah.' });
      }
      const settings = Object.fromEntries(database.Pengaturan.map((row) => [row.Kunci, row.Nilai]));
      session = { type: 'pengurus', id: user.ID, nama: user.Nama, username: user.Username, role: user.Role, jabatan: user.Jabatan, perm: permissions(user.Role), mustChangePassword: settings.WajibGantiPassword === user.ID, sessionVersion: settings.SesiVersi || '1' };
    } else if (body.type === 'warga') {
      const alamat = String(body.alamat || '').trim();
      const rumah = database.Rumah.find((row) => row.Alamat === alamat);
      if (!rumah) return send(res, 401, { error: 'Alamat rumah tidak terdaftar.' });
      const settings = Object.fromEntries(database.Pengaturan.map((row) => [row.Kunci, row.Nilai]));
      if (settings.PinWargaAktif === 'YA' && !verifyPassword(String(body.pin || ''), rumah.PINHash)) {
        return send(res, 401, { error: 'PIN rumah salah.' });
      }
      session = { type: 'warga', nama: `Warga ${alamat}`, alamat, role: 'Warga', perm: permissions('Warga'), sessionVersion: settings.SesiVersi || '1' };
    } else {
      return send(res, 400, { error: 'Jenis login tidak valid.' });
    }
    setSession(res, session);
    return send(res, 200, { ok: true, session, database: databaseForSession(database, session), revision: bridge.revision });
  } catch (error) {
    return send(res, 503, { error: error instanceof Error ? error.message : 'Autentikasi database gagal.' });
  }
}
