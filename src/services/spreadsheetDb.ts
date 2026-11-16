/**
 * RT 07 GO DIGITAL - Relational Spreadsheet Database Engine
 * Handles 3 Scenarios:
 * 1. Rumah Dimiliki & Dihuni Sendiri (A4/1 - Keluarga Pak Budi)
 * 2. Rumah Dikontrakkan ke Keluarga Lain (A4/2 - Pemilik Pak Aris, Penyewa Pak Bayu)
 * 3. Rumah Kosong Tetap Wajib Iuran (A4/3 - Pemilik Pak Toni)
 */

import {
  AgendaRow,
  AnggotaKeluargaDetail,
  GroupedPayment,
  InfoRow,
  KasRow,
  KategoriIuranUtama,
  KeluargaRow,
  LogRow,
  PembayaranRow,
  PendudukRow,
  PengurusRow,
  PeranKeluarga,
  PihakPembayar,
  PublicInfo,
  RiwayatHunianRow,
  RumahDetailView,
  RumahRow,
  SettingRow,
  SpreadsheetDatabase,
  StatusHunian,
  StatusMenghuni,
  TarifRow,
  TunggakanItem,
  TunggakanRumah,
  UserPermissions,
  UserSession,
} from '../types/database';

const DB_KEY = 'RT07_GO_DIGITAL_DB_V3';
const SESSION_KEY = 'RT07_USER_SESSION';

export const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const MS = BULAN.map((b) => b.slice(0, 3));

export const DEFAULT_SETTINGS: Record<string, string> = {
  NamaAplikasi: 'RT 07 GO DIGITAL',
  NamaRT: 'RT 07',
  AlamatRT: 'Bintang Metropol',
  PinWargaAktif: 'TIDAK',
  RekeningBank: '',
  RekeningNomor: '',
  RekeningAtasNama: '',
  MulaiIuran: '2026-01',
  NominalIuranRutin: '0',
  NominalIuranNonRutin: '0',
  GoogleWebAppUrl: '',
  GoogleSpreadsheetId: '',
  GoogleSpreadsheetTitle: '',
  GoogleSpreadsheetConnectionTitle: '',
  GoogleSpreadsheetConnectionCheckedAt: '',
};

export function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function nowStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function periodeNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function formatRupiah(n: number): string {
  return 'Rp ' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function periodeLabel(p: string): string {
  if (!p || p.length < 7) return p;
  const monthIdx = Number(p.slice(5, 7)) - 1;
  const year = p.slice(0, 4);
  return `${BULAN[monthIdx] || p.slice(5, 7)} ${year}`;
}

export function formatTanggalIndo(s: string): string {
  if (!s) return '-';
  const parts = s.split(' ')[0].split('-');
  if (parts.length < 3) return s;
  const day = Number(parts[2]);
  const month = BULAN[Number(parts[1]) - 1] || parts[1];
  const year = parts[0];
  return `${day} ${month} ${year}`;
}

function randStr(n: number): string {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}

export function genId(prefix: string): string {
  const d = new Date();
  const time = `${pad2(d.getFullYear() % 100)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  return `${prefix}-${time}-${randStr(4)}`;
}

export function genKode(): string {
  const d = new Date();
  const time = `${pad2(d.getFullYear() % 100)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  return `TRX-${time}-${randStr(5)}`;
}

export function makePasswordHash(pw: string): string {
  const salt = randStr(8).toLowerCase();
  let hash = 0;
  const combined = salt + pw;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `${salt}$${Math.abs(hash).toString(16)}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  if (!stored) return false;
  if (!stored.includes('$')) {
    return pw === stored;
  }
  const [salt, expectedHash] = stored.split('$');
  let hash = 0;
  const combined = salt + pw;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16) === expectedHash;
}

/**
 * Initial Clean Database (No Dummy Records)
 * Keeps only the default administrator login account and default settings.
 */
export function createDefaultDatabase(): SpreadsheetDatabase {
  const pengurus: PengurusRow[] = [
    {
      ID: 'PGR-001',
      Nama: 'Administrator RT',
      Username: 'admin',
      PasswordHash: makePasswordHash('admin123'),
      Jabatan: 'Administrator Sistem',
      Role: 'Admin',
      Status: 'Aktif',
      DibuatPada: nowStr(),
    },
  ];

  const pengaturan: SettingRow[] = Object.keys(DEFAULT_SETTINGS).map((k) => ({
    Kunci: k,
    Nilai: DEFAULT_SETTINGS[k],
  }));

  return {
    Rumah: [],
    Penduduk: [],
    Keluarga: [],
    RiwayatHunian: [],
    Pembayaran: [],
    BukuKas: [],
    Tarif: [],
    Agenda: [],
    Informasi: [],
    Pengurus: pengurus,
    Pengaturan: pengaturan,
    LogAktivitas: [],
  };
}

class SpreadsheetStore {
  private db: SpreadsheetDatabase;

  constructor() {
    this.db = this.loadFromStorage();
  }

  private loadFromStorage(): SpreadsheetDatabase {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.Rumah && parsed.Penduduk && parsed.Keluarga && parsed.RiwayatHunian) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse database from storage', e);
    }
    const fresh = createDefaultDatabase();
    this.saveToStorage(fresh);
    return fresh;
  }

  private saveToStorage(database: SpreadsheetDatabase) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(database));
    } catch (e) {
      console.error('Error saving database to storage', e);
    }
  }

  private persist() {
    this.saveToStorage(this.db);
  }

  public getRawDatabase(): SpreadsheetDatabase {
    return this.db;
  }

  public resetDatabase(): void {
    this.db = createDefaultDatabase();
    this.persist();
  }

  public logAction(user: string, aksi: string, detail: string) {
    this.db.LogAktivitas.unshift({
      Waktu: nowStr(),
      User: user || 'Sistem',
      Aksi: aksi,
      Detail: detail.slice(0, 500),
    });
    if (this.db.LogAktivitas.length > 500) {
      this.db.LogAktivitas = this.db.LogAktivitas.slice(0, 500);
    }
    this.persist();
  }

  public getSettings(): Record<string, string> {
    const o: Record<string, string> = { ...DEFAULT_SETTINGS };
    this.db.Pengaturan.forEach((r) => {
      o[r.Kunci] = r.Nilai;
    });
    return o;
  }

  private upsertSettingValue(key: string, value: string) {
    const idx = this.db.Pengaturan.findIndex((p) => p.Kunci === key);
    if (idx >= 0) {
      this.db.Pengaturan[idx].Nilai = value;
    } else {
      this.db.Pengaturan.push({ Kunci: key, Nilai: value });
    }
  }

  public setLinkedSpreadsheet(id: string, title: string, user: string) {
    this.upsertSettingValue('GoogleSpreadsheetId', id.trim());
    this.upsertSettingValue('GoogleSpreadsheetTitle', title.trim());
    if (id.trim()) {
      this.logAction(user, 'HUBUNGKAN_GSHEET', `Menghubungkan Google Sheets: ${title || id}`);
    } else {
      this.logAction(user, 'PUTUS_GSHEET', 'Memutuskan tautan Google Sheets');
    }
    this.persist();
  }

  public setGoogleWebAppUrl(url: string, user: string) {
    const nextUrl = url.trim();
    const currentUrl = this.getSettings().GoogleWebAppUrl;
    this.upsertSettingValue('GoogleWebAppUrl', nextUrl);
    if (currentUrl !== nextUrl) {
      this.upsertSettingValue('GoogleSpreadsheetConnectionTitle', '');
      this.upsertSettingValue('GoogleSpreadsheetConnectionCheckedAt', '');
    }
    this.logAction(user, 'ATUR_WEB_APP_GSHEET', nextUrl ? 'Menyimpan URL Web App Apps Script' : 'Menghapus URL Web App Apps Script');
    this.persist();
  }

  public setGoogleSpreadsheetConnectionStatus(title: string, checkedAt: string) {
    this.upsertSettingValue('GoogleSpreadsheetConnectionTitle', title.trim());
    this.upsertSettingValue('GoogleSpreadsheetConnectionCheckedAt', checkedAt.trim());
    this.persist();
  }

  private syncDefaultTarifFromSettings(newSettings: Record<string, string>) {
    const syncOne = (
      settingKey: 'NominalIuranRutin' | 'NominalIuranNonRutin',
      defaultId: string,
      jenisName: string,
      tipe: KategoriIuranUtama
    ) => {
      if (newSettings[settingKey] === undefined) return;
      const nom = Math.max(0, Number(newSettings[settingKey]) || 0);
      const exIdx = this.db.Tarif.findIndex(
        (t) =>
          t.ID === defaultId ||
          (t.JenisIuran.toLowerCase() === jenisName.toLowerCase() && t.KategoriIuran === 'Umum')
      );
      if (nom > 0) {
        if (exIdx >= 0) {
          this.db.Tarif[exIdx].Nominal = nom;
          this.db.Tarif[exIdx].TipeIuran = tipe;
          this.db.Tarif[exIdx].Status = 'Aktif';
        } else {
          this.db.Tarif.push({
            ID: defaultId,
            JenisIuran: jenisName,
            TipeIuran: tipe,
            KategoriIuran: 'Umum',
            Nominal: nom,
            Status: 'Aktif',
          });
        }
      } else if (exIdx >= 0) {
        this.db.Tarif[exIdx].Nominal = 0;
        this.db.Tarif[exIdx].Status = 'Nonaktif';
      }
    };

    syncOne('NominalIuranRutin', 'TRF-RUTIN-RT', 'Iuran Rutin', 'Iuran Rutin');
    syncOne('NominalIuranNonRutin', 'TRF-NONRUTIN-RT', 'Iuran Non Rutin', 'Iuran Non Rutin');
  }

  public saveSettings(newSettings: Record<string, string>, user: string) {
    Object.keys(newSettings).forEach((key) => {
      this.upsertSettingValue(key, newSettings[key]);
    });
    this.syncDefaultTarifFromSettings(newSettings);
    this.logAction(user, 'UBAH_PENGATURAN', Object.keys(newSettings).join(', '));
    this.persist();
  }

  public getPermissions(role: string): UserPermissions {
    return {
      pengurus: role !== 'Warga',
      ubahData: ['Admin', 'Ketua', 'Sekretaris'].includes(role),
      ubahKeuangan: ['Admin', 'Ketua', 'Bendahara'].includes(role),
      admin: role === 'Admin',
    };
  }

  // Session
  public getCurrentSession(): UserSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const sess: UserSession = JSON.parse(raw);
      if (sess.type === 'pengurus' && sess.id) {
        const p = this.db.Pengurus.find((x) => x.ID === sess.id);
        if (!p || p.Status !== 'Aktif') {
          sessionStorage.removeItem(SESSION_KEY);
          return null;
        }
        sess.role = p.Role;
        sess.nama = p.Nama;
        sess.jabatan = p.Jabatan;
        sess.perm = this.getPermissions(p.Role);
      } else if (sess.type === 'warga' && sess.alamat) {
        const rmh = this.db.Rumah.find((r) => r.Alamat === sess.alamat);
        if (!rmh) {
          sessionStorage.removeItem(SESSION_KEY);
          return null;
        }
      }
      return sess;
    } catch {
      return null;
    }
  }

  public setSession(sess: UserSession) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sess));
  }

  public clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // Auth: Warga Login
  public loginWarga(alamat: string, pin?: string): { session: UserSession } {
    const cleanInput = alamat.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanInput) throw new Error('Pilih alamat rumah Anda.');

    const rumah = this.db.Rumah.find((r) => {
      const dbAlm = r.Alamat.trim().toLowerCase().replace(/\s+/g, '');
      const dbNum = (r.Blok + '/' + r.Nomor).trim().toLowerCase().replace(/\s+/g, '');
      return dbAlm === cleanInput || dbNum === cleanInput;
    });

    if (!rumah) throw new Error(`Alamat rumah "${alamat}" tidak terdaftar dalam sistem.`);

    const settings = this.getSettings();
    if (settings.PinWargaAktif === 'YA') {
      if (!rumah.PINHash) {
        throw new Error('PIN rumah ini belum dibuat. Silakan hubungi pengurus RT.');
      }
      if (!verifyPassword(pin || '', rumah.PINHash)) {
        throw new Error('PIN rumah salah. Silakan coba lagi.');
      }
    }

    const detail = this.getRumahDetail(rumah.ID);
    const picNama = detail.penghuniAktif[0]?.penduduk.NamaLengkap || detail.pemilik?.NamaLengkap || `Warga Rumah ${rumah.Alamat}`;

    const session: UserSession = {
      type: 'warga',
      nama: `${picNama} (${rumah.Alamat})`,
      alamat: rumah.Alamat,
      role: 'Warga',
      perm: this.getPermissions('Warga'),
    };
    this.setSession(session);
    this.logAction(session.nama, 'LOGIN_WARGA', `Login warga rumah ${rumah.Alamat}`);
    return { session };
  }

  // Auth: Pengurus Login (Strictly Username & Password)
  public loginPengurus(username: string, password: string): { session: UserSession } {
    const u = username.trim().toLowerCase();
    if (!u || !password) throw new Error('Username dan password wajib diisi.');

    const p = this.db.Pengurus.find((x) => x.Username.trim().toLowerCase() === u);
    if (!p) throw new Error('Username atau password salah.');

    if (!verifyPassword(password, p.PasswordHash)) {
      throw new Error('Username atau password salah.');
    }

    if (p.Status !== 'Aktif') {
      throw new Error('Akun pengurus dinonaktifkan. Hubungi Administrator.');
    }

    const session: UserSession = {
      type: 'pengurus',
      id: p.ID,
      nama: p.Nama,
      username: p.Username,
      role: p.Role,
      jabatan: p.Jabatan,
      perm: this.getPermissions(p.Role),
    };
    this.setSession(session);
    this.logAction(p.Nama, 'LOGIN_PENGURUS', `Login pengurus: ${p.Username} (${p.Role})`);
    return { session };
  }

  public getPublicInfo(): PublicInfo {
    const st = this.getSettings();
    const daftarAlamat = this.db.Rumah.map((r) => r.Alamat).sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' })
    );
    return {
      namaAplikasi: st.NamaAplikasi || 'RT 07 GO DIGITAL',
      namaRT: st.NamaRT || 'RT 07',
      alamatRT: st.AlamatRT || '',
      pinWargaAktif: st.PinWargaAktif === 'YA',
      daftarAlamat,
    };
  }

  // ==========================================
  // RELATIONAL HOUSE & RESIDENT RESOLVERS
  // ==========================================
  public getRumahDetail(rumahIdOrAlamat: string): RumahDetailView {
    const rumah = this.db.Rumah.find(
      (r) => r.ID === rumahIdOrAlamat || r.Alamat === rumahIdOrAlamat
    );
    if (!rumah) throw new Error(`Data rumah ${rumahIdOrAlamat} tidak ditemukan.`);

    const pendudukMap = new Map<string, PendudukRow>();
    this.db.Penduduk.forEach((p) => pendudukMap.set(p.ID, p));

    // Links for this house
    const links = this.db.Keluarga.filter((k) => k.IDRumah === rumah.ID);

    const semuaAnggota: AnggotaKeluargaDetail[] = [];
    const keluargaPemilik: AnggotaKeluargaDetail[] = [];
    const keluargaPenyewa: AnggotaKeluargaDetail[] = [];
    const penghuniAktif: AnggotaKeluargaDetail[] = [];

    links.forEach((k) => {
      const p = pendudukMap.get(k.IDPenduduk);
      if (!p) return;
      const detail: AnggotaKeluargaDetail = { keluarga: k, penduduk: p };
      semuaAnggota.push(detail);

      if (k.Peran === 'Pemilik' || k.Peran === 'Anggota Keluarga Pemilik') {
        keluargaPemilik.push(detail);
      } else {
        keluargaPenyewa.push(detail);
      }

      if (k.StatusMenghuni === 'Menghuni') {
        penghuniAktif.push(detail);
      }
    });

    // Sort: Kepala Keluarga first, then Istri, then Anak
    const orderRank: Record<string, number> = {
      'Kepala Keluarga': 0,
      Istri: 1,
      Suami: 2,
      Anak: 3,
      Lainnya: 4,
    };
    const sortFn = (a: AnggotaKeluargaDetail, b: AnggotaKeluargaDetail) =>
      (orderRank[a.keluarga.HubunganKeluarga] ?? 5) - (orderRank[b.keluarga.HubunganKeluarga] ?? 5);

    keluargaPemilik.sort(sortFn);
    keluargaPenyewa.sort(sortFn);
    semuaAnggota.sort(sortFn);
    penghuniAktif.sort(sortFn);

    const pemilik = rumah.IDPemilik ? pendudukMap.get(rumah.IDPemilik) : keluargaPemilik.find((x) => x.keluarga.Peran === 'Pemilik')?.penduduk;
    const penanggungJawab = rumah.IDPenanggungJawabIuran ? pendudukMap.get(rumah.IDPenanggungJawabIuran) : pemilik;

    // Contact person: Penyewa if Dikontrakkan, else Pemilik
    let kepalaKeluargaAktif: PendudukRow | undefined;
    let kontakPenghuniAktif: string | undefined;

    if (rumah.StatusHunian === 'Dikontrakkan') {
      const kkPenyewa = keluargaPenyewa.find((x) => x.keluarga.HubunganKeluarga === 'Kepala Keluarga')?.penduduk;
      kepalaKeluargaAktif = kkPenyewa || keluargaPenyewa[0]?.penduduk;
      kontakPenghuniAktif = kepalaKeluargaAktif?.NoHP;
    } else if (rumah.StatusHunian === 'Dihuni Pemilik') {
      const kkPemilik = keluargaPemilik.find((x) => x.keluarga.HubunganKeluarga === 'Kepala Keluarga')?.penduduk;
      kepalaKeluargaAktif = kkPemilik || pemilik;
      kontakPenghuniAktif = kepalaKeluargaAktif?.NoHP;
    } else {
      // Kosong
      kepalaKeluargaAktif = pemilik;
      kontakPenghuniAktif = pemilik?.NoHP;
    }

    const riwayatHunian = this.db.RiwayatHunian.filter((r) => r.IDRumah === rumah.ID).sort(
      (a, b) => b.TanggalMulai.localeCompare(a.TanggalMulai)
    );

    return {
      rumah,
      pemilik,
      penanggungJawab,
      keluargaPemilik,
      keluargaPenyewa,
      semuaAnggota,
      penghuniAktif,
      riwayatHunian,
      kepalaKeluargaAktif,
      kontakPenghuniAktif,
      jumlahJiwaTinggal: penghuniAktif.length,
      jumlahJiwaTotal: semuaAnggota.length,
    };
  }

  public listRumah(): (RumahRow & {
    NamaPemilik: string;
    NamaPenghuni: string;
    NamaKepalaKeluarga: string;
    JumlahJiwa: number;
    NoHP: string;
  })[] {
    return this.db.Rumah.map((r) => {
      const detail = this.getRumahDetail(r.ID);
      const namaPemilik = detail.pemilik?.NamaLengkap || '-';
      const namaPenghuni = detail.keluargaPenyewa[0]?.penduduk.NamaLengkap || (r.StatusHunian === 'Dihuni Pemilik' ? namaPemilik : '-');
      const namaKK = detail.kepalaKeluargaAktif?.NamaLengkap || namaPemilik;
      const noHP = detail.kontakPenghuniAktif || detail.pemilik?.NoHP || '';

      return {
        ...r,
        NamaPemilik: namaPemilik,
        NamaPenghuni: namaPenghuni,
        NamaKepalaKeluarga: namaKK,
        JumlahJiwa: detail.jumlahJiwaTinggal,
        NoHP: noHP,
      };
    }).sort((a, b) => a.Alamat.localeCompare(b.Alamat, 'id', { numeric: true, sensitivity: 'base' }));
  }

  // Save or Add Rumah
  public saveRumah(
    data: {
      ID?: string;
      Blok: string;
      Nomor: string;
      Alamat?: string;
      StatusHunian: StatusHunian;
      IDPemilik?: string;
      IDPenanggungJawabIuran?: string;
      PihakPembayarIuran?: PihakPembayar;
      KategoriIuran?: string;
      Catatan?: string;
      PINHash?: string;
    },
    user: string
  ): { ID: string; isNew: boolean; alamat: string } {
    const blok = data.Blok.trim().toUpperCase();
    const nomor = data.Nomor.trim();
    if (!blok || !nomor) throw new Error('Blok dan nomor rumah wajib diisi.');

    const alamat = (data.Alamat || `Blok ${blok}/${nomor}`).trim();
    const status = data.StatusHunian || 'Dihuni Pemilik';
    const pembayar = data.PihakPembayarIuran || (status === 'Dikontrakkan' ? 'Penyewa' : 'Pemilik');

    if (data.ID) {
      const ex = this.db.Rumah.find((r) => r.ID === data.ID);
      if (!ex) throw new Error('Data rumah tidak ditemukan.');

      ex.Blok = blok;
      ex.Nomor = nomor;
      ex.Alamat = alamat;
      ex.StatusHunian = status;
      ex.PihakPembayarIuran = pembayar;
      if (data.IDPemilik) ex.IDPemilik = data.IDPemilik;
      if (data.IDPenanggungJawabIuran) ex.IDPenanggungJawabIuran = data.IDPenanggungJawabIuran;
      if (data.KategoriIuran) ex.KategoriIuran = data.KategoriIuran;
      if (data.Catatan !== undefined) ex.Catatan = data.Catatan;

      this.logAction(user, 'UBAH_RUMAH', `Memperbarui data rumah ${alamat} (${status})`);
      this.persist();
      return { ID: ex.ID, isNew: false, alamat: ex.Alamat };
    } else {
      const dup = this.db.Rumah.find(
        (r) => r.Alamat.toLowerCase() === alamat.toLowerCase() || (r.Blok === blok && r.Nomor === nomor)
      );
      if (dup) throw new Error(`Rumah ${alamat} sudah terdaftar.`);

      const newRumah: RumahRow = {
        ID: genId('RMH'),
        Blok: blok,
        Nomor: nomor,
        Alamat: alamat,
        StatusHunian: status,
        IDPemilik: data.IDPemilik || '',
        IDPenanggungJawabIuran: data.IDPenanggungJawabIuran || '',
        PihakPembayarIuran: pembayar,
        KategoriIuran: data.KategoriIuran || 'Umum',
        Catatan: data.Catatan || '',
        PINHash: data.PINHash ? makePasswordHash(data.PINHash) : '',
      };

      this.db.Rumah.push(newRumah);
      this.logAction(user, 'TAMBAH_RUMAH', `Menambahkan rumah ${alamat} (${status})`);
      this.persist();
      return { ID: newRumah.ID, isNew: true, alamat: newRumah.Alamat };
    }
  }

  // Delete Rumah
  public deleteRumah(id: string, user: string) {
    const idx = this.db.Rumah.findIndex((r) => r.ID === id);
    if (idx < 0) throw new Error('Rumah tidak ditemukan.');
    const rumah = this.db.Rumah[idx];

    const hasPay = this.db.Pembayaran.some((p) => p.AlamatRumah === rumah.Alamat);
    if (hasPay) {
      throw new Error(`Rumah ${rumah.Alamat} memiliki riwayat transaksi iuran. Data tidak dapat dihapus untuk menjaga integritas pembukuan.`);
    }

    // Remove relations
    this.db.Keluarga = this.db.Keluarga.filter((k) => k.IDRumah !== rumah.ID);
    this.db.RiwayatHunian = this.db.RiwayatHunian.filter((r) => r.IDRumah !== rumah.ID);
    this.db.Rumah.splice(idx, 1);

    this.logAction(user, 'HAPUS_RUMAH', `Menghapus rumah ${rumah.Alamat}`);
    this.persist();
  }

  public setPinRumah(id: string, pin: string, user: string) {
    const rumah = this.db.Rumah.find((r) => r.ID === id);
    if (!rumah) throw new Error('Rumah tidak ditemukan.');
    const cleanPin = pin.trim();
    if (!cleanPin) {
      rumah.PINHash = '';
      this.logAction(user, 'HAPUS_PIN', `Hapus PIN login rumah ${rumah.Alamat}`);
    } else {
      if (!/^\d{4,6}$/.test(cleanPin)) throw new Error('PIN harus berupa 4-6 digit angka.');
      rumah.PINHash = makePasswordHash(cleanPin);
      this.logAction(user, 'SET_PIN', `Set PIN login rumah ${rumah.Alamat}`);
    }
    this.persist();
  }

  // ==========================================
  // PENDUDUK & KELUARGA CRUD
  // ==========================================
  public listSemuaPenduduk() {
    return [...this.db.Penduduk].sort((a, b) => a.NamaLengkap.localeCompare(b.NamaLengkap));
  }

  public savePendudukDanKeluarga(
    rumahId: string,
    pendudukData: Partial<PendudukRow>,
    keluargaData: {
      ID?: string;
      HubunganKeluarga: KeluargaRow['HubunganKeluarga'];
      Peran: PeranKeluarga;
      StatusMenghuni: StatusMenghuni;
      IDKepalaKeluarga?: string;
    },
    user: string
  ) {
    const rumah = this.db.Rumah.find((r) => r.ID === rumahId);
    if (!rumah) throw new Error('Rumah tidak ditemukan.');

    const nama = (pendudukData.NamaLengkap || '').trim();
    if (!nama) throw new Error('Nama lengkap penduduk wajib diisi.');

    const nik = (pendudukData.NIK || '').replace(/\D/g, '');
    if (!/^\d{16}$/.test(nik)) {
      throw new Error('NIK harus tepat 16 digit angka.');
    }

    let pendudukId = pendudukData.ID;
    if (pendudukId) {
      // Edit existing resident
      const ex = this.db.Penduduk.find((p) => p.ID === pendudukId);
      if (!ex) throw new Error('Penduduk tidak ditemukan.');

      // Check NIK dup
      const dup = this.db.Penduduk.find((p) => p.NIK === nik && p.ID !== pendudukId);
      if (dup) throw new Error(`NIK ${nik} sudah terdaftar pada ${dup.NamaLengkap}.`);

      ex.NamaLengkap = nama;
      ex.NIK = nik;
      ex.JenisKelamin = pendudukData.JenisKelamin || 'Laki-laki';
      ex.TempatLahir = pendudukData.TempatLahir || '';
      ex.TanggalLahir = pendudukData.TanggalLahir || '';
      ex.NoHP = (pendudukData.NoHP || '').replace(/[^\d+]/g, '');
      ex.Pekerjaan = pendudukData.Pekerjaan || '';
      ex.StatusPenduduk = pendudukData.StatusPenduduk || 'Tetap';
      ex.StatusData = pendudukData.StatusData || 'Aktif';
    } else {
      // Add new resident (or attach existing if NIK matched)
      const existingByNik = this.db.Penduduk.find((p) => p.NIK === nik);
      if (existingByNik) {
        pendudukId = existingByNik.ID;
        existingByNik.NamaLengkap = nama;
        existingByNik.NoHP = pendudukData.NoHP || existingByNik.NoHP;
      } else {
        pendudukId = genId('PEN');
        const newPen: PendudukRow = {
          ID: pendudukId,
          NIK: nik,
          NamaLengkap: nama,
          JenisKelamin: pendudukData.JenisKelamin || 'Laki-laki',
          TempatLahir: pendudukData.TempatLahir || '',
          TanggalLahir: pendudukData.TanggalLahir || '',
          NoHP: (pendudukData.NoHP || '').replace(/[^\d+]/g, ''),
          Pekerjaan: pendudukData.Pekerjaan || '',
          StatusPenduduk: pendudukData.StatusPenduduk || (keluargaData.Peran.includes('Penyewa') ? 'Sementara' : 'Tetap'),
          StatusData: 'Aktif',
        };
        this.db.Penduduk.push(newPen);
      }
    }

    // Now update or create Keluarga link
    let link = keluargaData.ID ? this.db.Keluarga.find((k) => k.ID === keluargaData.ID) : null;
    if (!link) {
      link = this.db.Keluarga.find((k) => k.IDRumah === rumah.ID && k.IDPenduduk === pendudukId);
    }

    if (link) {
      link.HubunganKeluarga = keluargaData.HubunganKeluarga;
      link.Peran = keluargaData.Peran;
      link.StatusMenghuni = keluargaData.StatusMenghuni;
      if (keluargaData.IDKepalaKeluarga) link.IDKepalaKeluarga = keluargaData.IDKepalaKeluarga;
    } else {
      const newKel: KeluargaRow = {
        ID: genId('KEL'),
        IDRumah: rumah.ID,
        IDPenduduk: pendudukId,
        IDKepalaKeluarga: keluargaData.IDKepalaKeluarga || (keluargaData.HubunganKeluarga === 'Kepala Keluarga' ? pendudukId : undefined),
        HubunganKeluarga: keluargaData.HubunganKeluarga,
        Peran: keluargaData.Peran,
        StatusMenghuni: keluargaData.StatusMenghuni,
      };
      this.db.Keluarga.push(newKel);
    }

    // If marked as Pemilik, sync IDPemilik on Rumah
    if (keluargaData.Peran === 'Pemilik') {
      rumah.IDPemilik = pendudukId;
      if (!rumah.IDPenanggungJawabIuran) {
        rumah.IDPenanggungJawabIuran = pendudukId;
      }
    }

    this.logAction(user, 'SIMPAN_WARGA', `${nama} (${keluargaData.Peran} - ${rumah.Alamat})`);
    this.persist();
    return { pendudukId };
  }

  public deletePendudukDariRumah(idRumah: string, idPenduduk: string, user: string) {
    const kIdx = this.db.Keluarga.findIndex((k) => k.IDRumah === idRumah && k.IDPenduduk === idPenduduk);
    if (kIdx < 0) throw new Error('Data keanggotaan tidak ditemukan.');
    const p = this.db.Penduduk.find((x) => x.ID === idPenduduk);
    this.db.Keluarga.splice(kIdx, 1);

    this.logAction(user, 'HAPUS_WARGA_RUMAH', `Hapus ${p?.NamaLengkap || idPenduduk} dari rumah`);
    this.persist();
  }

  // Riwayat Hunian
  public addRiwayatHunian(
    data: {
      IDRumah: string;
      NamaKeluarga: string;
      JenisHunian: 'Pemilik' | 'Sewa';
      TanggalMulai: string;
      TanggalSelesai?: string;
      StatusHunian: 'Aktif' | 'Selesai';
      Catatan?: string;
    },
    user: string
  ) {
    const row: RiwayatHunianRow = {
      ID: genId('RWT'),
      IDRumah: data.IDRumah,
      NamaKeluarga: data.NamaKeluarga,
      JenisHunian: data.JenisHunian,
      TanggalMulai: data.TanggalMulai || todayStr(),
      TanggalSelesai: data.TanggalSelesai || '',
      StatusHunian: data.StatusHunian,
      Catatan: data.Catatan || '',
    };
    this.db.RiwayatHunian.push(row);
    this.logAction(user, 'TAMBAH_RIWAYAT_HUNIAN', `${data.NamaKeluarga} (${data.JenisHunian})`);
    this.persist();
    return row;
  }

  // Update Penanggung Jawab Iuran
  public setPenanggungJawabIuran(idRumah: string, idPenduduk: string, pihak: PihakPembayar, user: string) {
    const r = this.db.Rumah.find((x) => x.ID === idRumah);
    if (!r) throw new Error('Rumah tidak ditemukan.');
    r.IDPenanggungJawabIuran = idPenduduk;
    r.PihakPembayarIuran = pihak;
    this.logAction(user, 'SET_PENANGGUNG_JAWAB_IURAN', `Rumah ${r.Alamat} dibayar oleh ${pihak}`);
    this.persist();
  }

  // ==========================================
  // TARIF & KAS
  // ==========================================
  public listTarif(tipeFilter?: KategoriIuranUtama) {
    return [...this.db.Tarif]
      .map((t) => ({
        ...t,
        TipeIuran: (t.TipeIuran || 'Iuran Rutin') as KategoriIuranUtama,
      }))
      .filter((t) => !tipeFilter || t.TipeIuran === tipeFilter)
      .sort(
        (a, b) =>
          a.TipeIuran.localeCompare(b.TipeIuran) ||
          a.JenisIuran.localeCompare(b.JenisIuran) ||
          a.KategoriIuran.localeCompare(b.KategoriIuran)
      );
  }

  public getTipeForJenis(jenis: string): KategoriIuranUtama {
    const match = this.db.Tarif.find((t) => t.JenisIuran.toLowerCase() === jenis.toLowerCase());
    if (match?.TipeIuran) return match.TipeIuran;
    if (jenis.toLowerCase().includes('non rutin') || jenis.toLowerCase().includes('non-rutin')) {
      return 'Iuran Non Rutin';
    }
    return 'Iuran Rutin';
  }

  public getTarifFor(jenis: string, kategori: string): number {
    let exact = 0;
    let umum = 0;
    this.db.Tarif.forEach((t) => {
      if (t.Status !== 'Aktif' || t.JenisIuran !== jenis) return;
      if (t.KategoriIuran === kategori) exact = t.Nominal;
      if (t.KategoriIuran === 'Umum') umum = t.Nominal;
    });
    return exact || umum || 0;
  }

  public getActiveTarifJenis(tipeFilter?: KategoriIuranUtama): string[] {
    const set = new Set<string>();
    this.db.Tarif.forEach((t) => {
      if (t.Status !== 'Aktif') return;
      const tipe = t.TipeIuran || 'Iuran Rutin';
      if (tipeFilter && tipe !== tipeFilter) return;
      set.add(t.JenisIuran);
    });
    return Array.from(set);
  }

  public saveTarif(data: Partial<TarifRow>, user: string) {
    const jenis = (data.JenisIuran || '').trim();
    if (!jenis) throw new Error('Jenis iuran wajib diisi.');
    const tipe: KategoriIuranUtama = data.TipeIuran === 'Iuran Non Rutin' ? 'Iuran Non Rutin' : 'Iuran Rutin';
    const kat = (data.KategoriIuran || 'Umum').trim();
    const nom = Number(data.Nominal);
    if (!nom || nom <= 0) throw new Error('Nominal tarif harus lebih dari 0.');
    const stt = data.Status || 'Aktif';

    const dup = this.db.Tarif.find(
      (t) =>
        t.JenisIuran.toLowerCase() === jenis.toLowerCase() &&
        t.KategoriIuran.toLowerCase() === kat.toLowerCase() &&
        t.ID !== data.ID
    );
    if (dup) throw new Error(`Tarif ${jenis} (${kat}) sudah ada.`);

    if (data.ID) {
      const ex = this.db.Tarif.find((t) => t.ID === data.ID);
      if (!ex) throw new Error('Tarif tidak ditemukan.');
      ex.JenisIuran = jenis;
      ex.TipeIuran = tipe;
      ex.KategoriIuran = kat;
      ex.Nominal = nom;
      ex.Status = stt;
      if (ex.ID === 'TRF-RUTIN-RT') {
        this.upsertSettingValue('NominalIuranRutin', stt === 'Aktif' ? String(nom) : '0');
      } else if (ex.ID === 'TRF-NONRUTIN-RT') {
        this.upsertSettingValue('NominalIuranNonRutin', stt === 'Aktif' ? String(nom) : '0');
      }
      this.logAction(user, 'UBAH_TARIF', `[${tipe}] ${jenis} (${kat}): ${formatRupiah(nom)}`);
      this.persist();
      return { ID: ex.ID };
    } else {
      const newTarif: TarifRow = {
        ID: genId('TRF'),
        JenisIuran: jenis,
        TipeIuran: tipe,
        KategoriIuran: kat,
        Nominal: nom,
        Status: stt,
      };
      this.db.Tarif.push(newTarif);
      this.logAction(user, 'TAMBAH_TARIF', `[${tipe}] ${jenis} (${kat}): ${formatRupiah(nom)}`);
      this.persist();
      return { ID: newTarif.ID };
    }
  }

  public deleteTarif(id: string, user: string) {
    const idx = this.db.Tarif.findIndex((t) => t.ID === id);
    if (idx < 0) throw new Error('Tarif tidak ditemukan.');
    const t = this.db.Tarif[idx];
    this.db.Tarif.splice(idx, 1);
    if (t.ID === 'TRF-RUTIN-RT') {
      this.upsertSettingValue('NominalIuranRutin', '0');
    } else if (t.ID === 'TRF-NONRUTIN-RT') {
      this.upsertSettingValue('NominalIuranNonRutin', '0');
    }
    this.logAction(user, 'HAPUS_TARIF', `${t.JenisIuran} (${t.KategoriIuran})`);
    this.persist();
  }

  public getKasSummary() {
    const nowP = periodeNow();
    let saldo = 0;
    let totalMasuk = 0;
    let totalKeluar = 0;
    let bulanMasuk = 0;
    let bulanKeluar = 0;
    const monthlyMap: Record<string, { masuk: number; keluar: number }> = {};

    const sortedKas = [...this.db.BukuKas].sort((a, b) => a.Tanggal.localeCompare(b.Tanggal));

    sortedKas.forEach((k) => {
      const p = k.Tanggal.slice(0, 7);
      if (!monthlyMap[p]) monthlyMap[p] = { masuk: 0, keluar: 0 };

      if (k.Jenis === 'Pemasukan') {
        saldo += k.Nominal;
        totalMasuk += k.Nominal;
        monthlyMap[p].masuk += k.Nominal;
        if (p === nowP) bulanMasuk += k.Nominal;
      } else {
        saldo -= k.Nominal;
        totalKeluar += k.Nominal;
        monthlyMap[p].keluar += k.Nominal;
        if (p === nowP) bulanKeluar += k.Nominal;
      }
      k.Saldo = saldo;
    });

    const series: { periode: string; label: string; masuk: number; keluar: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const p = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      series.push({
        periode: p,
        label: `${MS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
        masuk: monthlyMap[p]?.masuk || 0,
        keluar: monthlyMap[p]?.keluar || 0,
      });
    }

    return { saldo, totalMasuk, totalKeluar, bulanMasuk, bulanKeluar, series };
  }

  public listKas(filter?: { dari?: string; sampai?: string; jenis?: string; kategori?: string; q?: string }) {
    const q = (filter?.q || '').toLowerCase().trim();
    let saldo = 0;
    const kategoriSet = new Set<string>();

    const sorted = [...this.db.BukuKas].sort((a, b) => a.Tanggal.localeCompare(b.Tanggal));
    sorted.forEach((k) => {
      saldo += k.Jenis === 'Pemasukan' ? k.Nominal : -k.Nominal;
      k.Saldo = saldo;
      if (k.Kategori) kategoriSet.add(k.Kategori);
    });

    let filtered = sorted.filter((k) => {
      if (filter?.dari && k.Tanggal < filter.dari) return false;
      if (filter?.sampai && k.Tanggal > filter.sampai) return false;
      if (filter?.jenis && k.Jenis !== filter.jenis) return false;
      if (filter?.kategori && k.Kategori !== filter.kategori) return false;
      if (q && !(k.Uraian + ' ' + k.Kategori).toLowerCase().includes(q)) return false;
      return true;
    });

    let tin = 0;
    let tout = 0;
    filtered.forEach((k) => {
      if (k.Jenis === 'Pemasukan') tin += k.Nominal;
      else tout += k.Nominal;
    });

    return {
      rows: filtered.reverse(),
      totalMasuk: tin,
      totalKeluar: tout,
      selisih: tin - tout,
      saldoAkhir: saldo,
      kategori: Array.from(kategoriSet).sort(),
    };
  }

  public saveKas(data: Partial<KasRow>, user: string) {
    const tgl = data.Tanggal || todayStr();
    const jenis = data.Jenis;
    if (jenis !== 'Pemasukan' && jenis !== 'Pengeluaran') {
      throw new Error('Jenis transaksi kas harus Pemasukan atau Pengeluaran.');
    }
    const kat = (data.Kategori || '').trim();
    if (!kat) throw new Error('Kategori kas wajib diisi.');
    const ur = (data.Uraian || '').trim();
    if (!ur) throw new Error('Uraian transaksi kas wajib diisi.');
    const nom = Number(data.Nominal);
    if (!nom || nom <= 0) throw new Error('Nominal kas harus lebih dari 0.');

    if (data.ID) {
      const ex = this.db.BukuKas.find((k) => k.ID === data.ID);
      if (!ex) throw new Error('Data kas tidak ditemukan.');
      if (ex.SumberReferensi) {
        throw new Error('Transaksi ini otomatis dibuat dari iuran warga.');
      }
      ex.Tanggal = tgl;
      ex.Jenis = jenis;
      ex.Kategori = kat;
      ex.Uraian = ur;
      ex.Nominal = nom;
      ex.DicatatOleh = user;
      this.logAction(user, 'UBAH_KAS', `${jenis} ${formatRupiah(nom)} - ${ur}`);
      this.persist();
      return { ID: ex.ID };
    } else {
      const newKas: KasRow = {
        ID: genId('KAS'),
        Tanggal: tgl,
        Jenis: jenis,
        Kategori: kat,
        Uraian: ur,
        Nominal: nom,
        SumberReferensi: '',
        DicatatOleh: user,
      };
      this.db.BukuKas.push(newKas);
      this.logAction(user, 'TAMBAH_KAS', `${jenis} ${formatRupiah(nom)} - ${ur}`);
      this.persist();
      return { ID: newKas.ID };
    }
  }

  public deleteKas(id: string, user: string) {
    const idx = this.db.BukuKas.findIndex((k) => k.ID === id);
    if (idx < 0) throw new Error('Data kas tidak ditemukan.');
    const k = this.db.BukuKas[idx];
    if (k.SumberReferensi) {
      throw new Error('Transaksi ini terhubung ke iuran warga.');
    }
    this.db.BukuKas.splice(idx, 1);
    this.logAction(user, 'HAPUS_KAS', `${k.Jenis} ${formatRupiah(k.Nominal)} - ${k.Uraian}`);
    this.persist();
  }

  // ==========================================
  // IURAN, TUNNGAKAN, & VERIFIKASI
  // ==========================================
  public getPaymentIndex(): Record<string, string> {
    const idx: Record<string, string> = {};
    this.db.Pembayaran.forEach((p) => {
      if (p.Status === 'Ditolak') return;
      const k = `${p.AlamatRumah}|${p.JenisIuran}|${p.Periode}`;
      if (!idx[k] || p.Status === 'Terverifikasi') {
        idx[k] = p.Status;
      }
    });
    return idx;
  }

  public getPeriodeList(start: string, end: string): string[] {
    const out: string[] = [];
    let y = Number(start.slice(0, 4));
    let m = Number(start.slice(5, 7));
    while (out.length < 240) {
      const p = `${y}-${pad2(m)}`;
      if (p > end) break;
      out.push(p);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return out;
  }

  public getTunggakanRumah(rumah: RumahRow): TunggakanItem[] {
    const st = this.getSettings();
    const start = st.MulaiIuran || '2026-01';
    const end = periodeNow();
    const idx = this.getPaymentIndex();
    const pers = this.getPeriodeList(start, end);
    // Hanya Iuran Rutin yang menghasilkan tagihan bulanan berulang
    const activeRutinJenis = this.getActiveTarifJenis('Iuran Rutin');
    const items: TunggakanItem[] = [];

    activeRutinJenis.forEach((j) => {
      const nom = this.getTarifFor(j, rumah.KategoriIuran || 'Umum');
      if (!nom) return;
      const missing = pers.filter((p) => !idx[`${rumah.Alamat}|${j}|${p}`]);
      if (missing.length > 0) {
        items.push({
          jenis: j,
          tipeIuran: 'Iuran Rutin',
          nominal: nom,
          periode: missing,
          jumlah: missing.length,
          subtotal: nom * missing.length,
        });
      }
    });
    return items;
  }

  public getGroupedPayments(filter?: {
    status?: string;
    tahun?: string;
    alamat?: string;
    tipeIuran?: KategoriIuranUtama | '';
    q?: string;
  }): GroupedPayment[] {
    const q = (filter?.q || '').toLowerCase().trim();
    let rows = [...this.db.Pembayaran];

    if (filter?.status) {
      rows = rows.filter((p) => p.Status === filter.status);
    }
    if (filter?.tahun) {
      rows = rows.filter((p) => p.Periode.startsWith(filter.tahun!) || p.TanggalBayar.startsWith(filter.tahun!));
    }
    if (filter?.alamat) {
      rows = rows.filter((p) => p.AlamatRumah === filter.alamat);
    }
    if (filter?.tipeIuran) {
      rows = rows.filter((p) => (p.TipeIuran || this.getTipeForJenis(p.JenisIuran)) === filter.tipeIuran);
    }

    const map: Record<string, GroupedPayment> = {};
    const order: string[] = [];

    rows.forEach((p) => {
      const k = p.KodeTransaksi || p.ID;
      const tipe = p.TipeIuran || this.getTipeForJenis(p.JenisIuran);
      if (!map[k]) {
        map[k] = {
          kode: k,
          alamat: p.AlamatRumah,
          jenis: p.JenisIuran,
          tipeIuran: tipe,
          periode: [],
          ids: [],
          total: 0,
          tanggalBayar: p.TanggalBayar,
          metode: p.MetodeBayar,
          adaBukti: Boolean(p.BuktiURL),
          buktiURL: p.BuktiURL,
          status: p.Status,
          pihakPembayar: p.PihakPembayar || 'Pemilik',
          catatan: p.CatatanVerifikator,
          diverifikasiOleh: p.DiverifikasiOleh,
          tanggalVerifikasi: p.TanggalVerifikasi,
        };
        order.push(k);
      }
      map[k].periode.push(p.Periode);
      map[k].ids.push(p.ID);
      map[k].total += p.Nominal;
    });

    let grouped = order.map((k) => {
      map[k].periode.sort();
      return map[k];
    });

    if (q) {
      grouped = grouped.filter(
        (x) =>
          x.alamat.toLowerCase().includes(q) ||
          x.jenis.toLowerCase().includes(q) ||
          x.tipeIuran.toLowerCase().includes(q) ||
          x.kode.toLowerCase().includes(q)
      );
    }

    grouped.sort((a, b) => b.tanggalBayar.localeCompare(a.tanggalBayar) || b.kode.localeCompare(a.kode));
    return grouped;
  }

  public getFormBayar(alamat: string) {
    const rumah = this.db.Rumah.find((r) => r.Alamat === alamat);
    if (!rumah) throw new Error(`Data rumah ${alamat} tidak ditemukan.`);

    const st = this.getSettings();
    const activeJenis = this.getActiveTarifJenis();
    const jenisWithNominal = activeJenis
      .map((j) => ({
        jenis: j,
        tipeIuran: this.getTipeForJenis(j),
        nominal: this.getTarifFor(j, rumah.KategoriIuran || 'Umum'),
      }))
      .filter((x) => x.nominal > 0);

    const terpakai: Record<string, { periode: string; status: string }[]> = {};
    this.db.Pembayaran.forEach((p) => {
      if (p.AlamatRumah !== rumah.Alamat || p.Status === 'Ditolak') return;
      const tipe = p.TipeIuran || this.getTipeForJenis(p.JenisIuran);
      if (tipe !== 'Iuran Rutin') return;
      if (!terpakai[p.JenisIuran]) terpakai[p.JenisIuran] = [];
      terpakai[p.JenisIuran].push({ periode: p.Periode, status: p.Status });
    });

    const detail = this.getRumahDetail(rumah.ID);

    return {
      alamat: rumah.Alamat,
      statusHunian: rumah.StatusHunian,
      pihakPembayarIuran: rumah.PihakPembayarIuran,
      penanggungJawabNama: detail.penanggungJawab?.NamaLengkap || detail.pemilik?.NamaLengkap || 'Warga',
      kategori: rumah.KategoriIuran || 'Umum',
      jenis: jenisWithNominal,
      terpakai,
      mulaiIuran: st.MulaiIuran || '2026-01',
      tahunSekarang: new Date().getFullYear(),
      rekening: {
        bank: st.RekeningBank || '-',
        nomor: st.RekeningNomor || '-',
        atasNama: st.RekeningAtasNama || 'Bendahara RT 07',
      },
    };
  }

  public createPayments(
    alamat: string,
    payload: {
      jenis: string;
      tipeIuran?: KategoriIuranUtama;
      periode: string[];
      nominalCustom?: number;
      tanggalBayar: string;
      metode: string;
      buktiURL?: string;
      catatan?: string;
      pihakPembayar?: PihakPembayar;
    },
    user: string,
    autoVerify: boolean
  ) {
    const rumah = this.db.Rumah.find((r) => r.Alamat === alamat);
    if (!rumah) throw new Error('Data rumah tidak ditemukan.');

    const jenis = (payload.jenis || '').trim();
    if (!jenis) throw new Error('Pilih jenis iuran.');

    const tipeIuran: KategoriIuranUtama = payload.tipeIuran || this.getTipeForJenis(jenis);
    const tarifNominal = this.getTarifFor(jenis, rumah.KategoriIuran || 'Umum');
    const tgl = payload.tanggalBayar || todayStr();
    const kode = genKode();
    const status = autoVerify ? 'Terverifikasi' : 'Menunggu Verifikasi';
    const pihak = payload.pihakPembayar || rumah.PihakPembayarIuran || 'Pemilik';

    if (tipeIuran === 'Iuran Non Rutin') {
      const nomNonRutin = Number(payload.nominalCustom) > 0 ? Number(payload.nominalCustom) : tarifNominal;
      if (!nomNonRutin || nomNonRutin <= 0) {
        throw new Error(`Nominal iuran non rutin "${jenis}" belum diatur.`);
      }
      const per = tgl.slice(0, 7);
      const year = Number(per.slice(0, 4));
      const month = Number(per.slice(5, 7));

      const payRow: PembayaranRow = {
        ID: genId('PAY'),
        AlamatRumah: rumah.Alamat,
        JenisIuran: jenis,
        TipeIuran: 'Iuran Non Rutin',
        Periode: per,
        Tahun: year,
        Bulan: month,
        Nominal: nomNonRutin,
        TanggalBayar: tgl,
        MetodeBayar: payload.metode || 'Transfer',
        BuktiURL: payload.buktiURL || '',
        KodeTransaksi: kode,
        Status: status,
        PihakPembayar: pihak,
        CatatanVerifikator:
          payload.catatan?.trim() || (autoVerify ? 'Dicatat langsung oleh pengurus' : ''),
        DiverifikasiOleh: autoVerify ? user : '',
        TanggalVerifikasi: autoVerify ? nowStr() : '',
      };
      this.db.Pembayaran.push(payRow);

      if (autoVerify) {
        this.db.BukuKas.push({
          ID: genId('KAS'),
          Tanggal: tgl,
          Jenis: 'Pemasukan',
          Kategori: `Iuran Non Rutin - ${jenis}`,
          Uraian: `${jenis} (${formatTanggalIndo(tgl)}) - ${rumah.Alamat} (${pihak})${payload.catatan ? ` · ${payload.catatan}` : ''}`,
          Nominal: nomNonRutin,
          SumberReferensi: payRow.ID,
          DicatatOleh: user,
        });
      }

      this.logAction(
        user,
        autoVerify ? 'CATAT_BAYAR_MANUAL' : 'UPLOAD_BAYAR_WARGA',
        `[Iuran Non Rutin] ${rumah.Alamat} - ${jenis}: ${formatRupiah(nomNonRutin)} oleh ${pihak} [${kode}]`
      );
      this.persist();

      return {
        kode,
        jumlahBulan: 1,
        total: nomNonRutin,
        status,
        pihakPembayar: pihak,
      };
    }

    // IURAN RUTIN (Bulanan)
    const nominal = tarifNominal;
    if (!nominal) throw new Error(`Tarif iuran "${jenis}" belum diatur.`);

    const uniquePeriods = Array.from(new Set(payload.periode || [])).filter(Boolean);
    if (!uniquePeriods.length) throw new Error('Pilih minimal satu bulan iuran.');

    const idx = this.getPaymentIndex();
    const dup = uniquePeriods.filter((p) => idx[`${rumah.Alamat}|${jenis}|${p}`]);
    if (dup.length > 0) {
      throw new Error(`Bulan berikut sudah dibayar atau sedang menunggu verifikasi: ${dup.map(periodeLabel).join(', ')}`);
    }

    uniquePeriods.sort();
    uniquePeriods.forEach((per) => {
      const year = Number(per.slice(0, 4));
      const month = Number(per.slice(5, 7));

      const payRow: PembayaranRow = {
        ID: genId('PAY'),
        AlamatRumah: rumah.Alamat,
        JenisIuran: jenis,
        TipeIuran: 'Iuran Rutin',
        Periode: per,
        Tahun: year,
        Bulan: month,
        Nominal: nominal,
        TanggalBayar: tgl,
        MetodeBayar: payload.metode || 'Transfer',
        BuktiURL: payload.buktiURL || '',
        KodeTransaksi: kode,
        Status: status,
        PihakPembayar: pihak,
        CatatanVerifikator: autoVerify ? payload.catatan || 'Dicatat langsung oleh pengurus' : payload.catatan || '',
        DiverifikasiOleh: autoVerify ? user : '',
        TanggalVerifikasi: autoVerify ? nowStr() : '',
      };
      this.db.Pembayaran.push(payRow);

      if (autoVerify) {
        this.db.BukuKas.push({
          ID: genId('KAS'),
          Tanggal: tgl,
          Jenis: 'Pemasukan',
          Kategori: `Iuran Rutin - ${jenis}`,
          Uraian: `${jenis} ${periodeLabel(per)} - ${rumah.Alamat} (${pihak})`,
          Nominal: nominal,
          SumberReferensi: payRow.ID,
          DicatatOleh: user,
        });
      }
    });

    const total = nominal * uniquePeriods.length;
    this.logAction(
      user,
      autoVerify ? 'CATAT_BAYAR_MANUAL' : 'UPLOAD_BAYAR_WARGA',
      `[Iuran Rutin] ${rumah.Alamat} - ${jenis} (${uniquePeriods.length} bln): ${formatRupiah(total)} oleh ${pihak} [${kode}]`
    );
    this.persist();

    return {
      kode,
      jumlahBulan: uniquePeriods.length,
      total,
      status,
      pihakPembayar: pihak,
    };
  }

  public verifyPayment(kode: string, action: 'terima' | 'tolak', catatan: string, user: string) {
    const rows = this.db.Pembayaran.filter(
      (p) => p.KodeTransaksi === kode && p.Status === 'Menunggu Verifikasi'
    );
    if (!rows.length) throw new Error('Transaksi pembayaran tidak ditemukan.');

    if (action === 'tolak' && !catatan.trim()) {
      throw new Error('Wajib menuliskan alasan penolakan.');
    }

    const newStatus = action === 'terima' ? 'Terverifikasi' : 'Ditolak';
    const now = nowStr();

    rows.forEach((r) => {
      const tipe = r.TipeIuran || this.getTipeForJenis(r.JenisIuran);
      r.Status = newStatus;
      if (catatan.trim()) {
        r.CatatanVerifikator = catatan.trim();
      }
      r.DiverifikasiOleh = user;
      r.TanggalVerifikasi = now;

      if (action === 'terima') {
        const exists = this.db.BukuKas.some((k) => k.SumberReferensi === r.ID);
        if (!exists) {
          this.db.BukuKas.push({
            ID: genId('KAS'),
            Tanggal: r.TanggalBayar || todayStr(),
            Jenis: 'Pemasukan',
            Kategori: `${tipe} - ${r.JenisIuran}`,
            Uraian:
              tipe === 'Iuran Non Rutin'
                ? `${r.JenisIuran} (${formatTanggalIndo(r.TanggalBayar)}) - ${r.AlamatRumah} (${r.PihakPembayar || 'Warga'})`
                : `${r.JenisIuran} ${periodeLabel(r.Periode)} - ${r.AlamatRumah} (${r.PihakPembayar || 'Warga'})`,
            Nominal: r.Nominal,
            SumberReferensi: r.ID,
            DicatatOleh: user,
          });
        }
      }
    });

    this.logAction(
      user,
      action === 'terima' ? 'TERIMA_BAYAR' : 'TOLAK_BAYAR',
      `${kode} (${rows[0].AlamatRumah}) - ${action === 'terima' ? 'Diterima' : 'Ditolak'}`
    );
    this.persist();
  }

  public deletePayment(kode: string, user: string) {
    const rows = this.db.Pembayaran.filter((p) => p.KodeTransaksi === kode);
    if (!rows.length) throw new Error('Transaksi tidak ditemukan.');
    const alamat = rows[0].AlamatRumah;
    const ids = new Set(rows.map((r) => r.ID));

    this.db.BukuKas = this.db.BukuKas.filter((k) => !ids.has(k.SumberReferensi));
    this.db.Pembayaran = this.db.Pembayaran.filter((p) => p.KodeTransaksi !== kode);

    this.logAction(user, 'HAPUS_BAYAR', `Hapus transaksi ${kode} (${alamat})`);
    this.persist();
  }

  public getRiwayatIuran(alamat: string, tahun: number) {
    const rumah = this.db.Rumah.find((r) => r.Alamat === alamat);
    if (!rumah) throw new Error(`Data rumah ${alamat} tidak ditemukan.`);

    const st = this.getSettings();
    const start = st.MulaiIuran || '2026-01';
    const nowP = periodeNow();
    const idx = this.getPaymentIndex();

    const activeRutinJenis = this.getActiveTarifJenis('Iuran Rutin');
    const housePayments = this.db.Pembayaran.filter((p) => p.AlamatRumah === rumah.Alamat);
    const paidRutinJenis = housePayments
      .filter((p) => (p.TipeIuran || this.getTipeForJenis(p.JenisIuran)) === 'Iuran Rutin')
      .map((p) => p.JenisIuran);
    const allRutinJenis = Array.from(new Set([...activeRutinJenis, ...paidRutinJenis]));

    const grid: Record<string, Record<string, 'lunas' | 'menunggu' | 'belum' | 'akan' | 'na'>> = {};
    allRutinJenis.forEach((j) => {
      grid[j] = {};
      for (let m = 1; m <= 12; m++) {
        const mm = pad2(m);
        const per = `${tahun}-${mm}`;
        const stt = idx[`${rumah.Alamat}|${j}|${per}`];
        if (stt === 'Terverifikasi') grid[j][mm] = 'lunas';
        else if (stt === 'Menunggu Verifikasi') grid[j][mm] = 'menunggu';
        else if (per < start) grid[j][mm] = 'na';
        else if (per > nowP) grid[j][mm] = 'akan';
        else grid[j][mm] = 'belum';
      }
    });

    const tunggakan = this.getTunggakanRumah(rumah);
    let totalTunggakan = 0;
    tunggakan.forEach((t) => (totalTunggakan += t.subtotal));

    const transaksi = this.getGroupedPayments({ alamat: rumah.Alamat });
    const nonRutinTransaksi = transaksi.filter((t) => t.tipeIuran === 'Iuran Non Rutin');
    const nonRutinTotal = nonRutinTransaksi
      .filter((t) => t.status === 'Terverifikasi')
      .reduce((acc, t) => acc + t.total, 0);

    const detail = this.getRumahDetail(rumah.ID);

    return {
      alamat: rumah.Alamat,
      statusHunian: rumah.StatusHunian,
      pihakPembayarIuran: rumah.PihakPembayarIuran,
      penanggungJawab: detail.penanggungJawab?.NamaLengkap || detail.pemilik?.NamaLengkap || '-',
      tahun,
      jenis: allRutinJenis,
      grid,
      transaksi,
      nonRutinTransaksi,
      nonRutinTotal,
      tunggakan,
      totalTunggakan,
    };
  }

  public getMatriks(tahun: number, jenis?: string) {
    const st = this.getSettings();
    const start = st.MulaiIuran || '2026-01';
    const nowP = periodeNow();
    const idx = this.getPaymentIndex();
    const activeRutinJenis = this.getActiveTarifJenis('Iuran Rutin');
    const selectedJenis = jenis && activeRutinJenis.includes(jenis) ? jenis : activeRutinJenis[0] || '';

    const rumahList = this.listRumah();
    const rows = selectedJenis
      ? rumahList.map((r) => {
          const bulan: Record<string, 'lunas' | 'menunggu' | 'belum' | 'akan' | 'na'> = {};
          for (let m = 1; m <= 12; m++) {
            const mm = pad2(m);
            const per = `${tahun}-${mm}`;
            const stt = idx[`${r.Alamat}|${selectedJenis}|${per}`];
            if (stt === 'Terverifikasi') bulan[mm] = 'lunas';
            else if (stt === 'Menunggu Verifikasi') bulan[mm] = 'menunggu';
            else if (per < start) bulan[mm] = 'na';
            else if (per > nowP) bulan[mm] = 'akan';
            else bulan[mm] = 'belum';
          }
          return {
            alamat: r.Alamat,
            statusHunian: r.StatusHunian,
            pihakPembayar: r.PihakPembayarIuran,
            kepala: r.NamaKepalaKeluarga,
            bulan,
          };
        })
      : [];

    // Rekap Iuran Non Rutin per rumah
    const nonRutinJenis = this.getActiveTarifJenis('Iuran Non Rutin');
    const nonRutinPayments = this.getGroupedPayments({
      tipeIuran: 'Iuran Non Rutin',
      tahun: String(tahun),
    });

    const nonRutinRows = rumahList.map((r) => {
      const houseTx = nonRutinPayments.filter((p) => p.alamat === r.Alamat);
      const lunasTotal = houseTx
        .filter((p) => p.status === 'Terverifikasi')
        .reduce((acc, p) => acc + p.total, 0);
      const menungguCount = houseTx.filter((p) => p.status === 'Menunggu Verifikasi').length;
      const lastTx = houseTx[0];
      return {
        alamat: r.Alamat,
        statusHunian: r.StatusHunian,
        kepala: r.NamaKepalaKeluarga,
        jumlahTransaksi: houseTx.filter((p) => p.status === 'Terverifikasi').length,
        menungguCount,
        totalNominal: lunasTotal,
        terakhirBayar: lastTx?.tanggalBayar || '',
        rincianJenis: Array.from(new Set(houseTx.filter((p) => p.status === 'Terverifikasi').map((p) => p.jenis))),
      };
    });

    return {
      tahun,
      jenis: selectedJenis,
      daftarJenis: activeRutinJenis,
      rows,
      daftarNonRutinJenis: nonRutinJenis,
      nonRutinRows,
    };
  }

  // Rekap Tunggakan All Houses + WhatsApp Generator
  public getRekapTunggakan() {
    const st = this.getSettings();
    const list: TunggakanRumah[] = [];
    let grandTotal = 0;

    this.db.Rumah.forEach((r) => {
      const items = this.getTunggakanRumah(r);
      if (!items.length) return;

      let subtotal = 0;
      let bulanCount = 0;
      items.forEach((i) => {
        subtotal += i.subtotal;
        bulanCount += i.jumlah;
      });
      grandTotal += subtotal;

      const detail = this.getRumahDetail(r.ID);
      const penanggungJawab = detail.penanggungJawab || detail.pemilik;
      const namaTujuan = penanggungJawab?.NamaLengkap || 'Bapak/Ibu Warga';
      const noHP = penanggungJawab?.NoHP || detail.kontakPenghuniAktif || '';

      const rincian = items
        .map((i) => `• ${i.jenis}: ${i.periode.map(periodeLabel).join(', ')} (${formatRupiah(i.subtotal)})`)
        .join('\n');

      const pesan =
        `Assalamu'alaikum Wr. Wb.\n` +
        `Yth. Bapak/Ibu ${namaTujuan} (${r.PihakPembayarIuran} ${r.Alamat}),\n\n` +
        `Kami dari Pengurus ${st.NamaRT} menyampaikan informasi iuran rumah ${r.Alamat} yang belum tercatat:\n` +
        `${rincian}\n` +
        `*Total Tunggakan: ${formatRupiah(subtotal)}* (${bulanCount} bulan)\n\n` +
        `Pembayaran dapat ditransfer ke rekening kas RT:\n` +
        `*${st.RekeningBank} ${st.RekeningNomor}*\n` +
        `a.n. ${st.RekeningAtasNama}\n\n` +
        `Setelah transfer, mohon konfirmasi atau unggah bukti di aplikasi *${st.NamaAplikasi}*.\n` +
        `Abaikan pesan ini apabila sudah melakukan pembayaran. Terima kasih atas partisipasi dan kerjasamanya.`;

      list.push({
        alamat: r.Alamat,
        statusHunian: r.StatusHunian,
        kepala: namaTujuan,
        pihakPembayar: r.PihakPembayarIuran,
        noHP,
        items,
        totalBulan: bulanCount,
        totalNominal: subtotal,
        pesan,
      });
    });

    return {
      rows: list,
      totalRumah: list.length,
      totalNominal: grandTotal,
      sampaiPeriode: periodeNow(),
    };
  }

  // Dashboard Data Provider
  public getDashboardData(session: UserSession) {
    const st = this.getSettings();
    const kasSummary = this.getKasSummary();
    const today = todayStr();

    const agenda = [...this.db.Agenda]
      .filter((a) => a.Status === 'Akan Datang' && a.Tanggal >= today)
      .sort((a, b) => (a.Tanggal + a.Waktu).localeCompare(b.Tanggal + b.Waktu))
      .slice(0, 4);

    const info = [...this.db.Informasi]
      .filter((i) => i.Status === 'Publish')
      .sort((a, b) => b.TanggalTerbit.localeCompare(a.TanggalTerbit))
      .slice(0, 4);

    if (session.type === 'warga' && session.alamat) {
      const rumah = this.db.Rumah.find((r) => r.Alamat === session.alamat);
      const tunggakan = rumah ? this.getTunggakanRumah(rumah) : [];
      let totalBulan = 0;
      let totalNominal = 0;
      tunggakan.forEach((t) => {
        totalBulan += t.jumlah;
        totalNominal += t.subtotal;
      });

      const menunggu = this.db.Pembayaran.filter(
        (p) => p.AlamatRumah === session.alamat && p.Status === 'Menunggu Verifikasi'
      );
      const uniqueMenungguTrx = new Set(menunggu.map((p) => p.KodeTransaksi)).size;

      return {
        role: 'Warga',
        namaRT: st.NamaRT,
        saldo: kasSummary.saldo,
        bulanIni: { masuk: kasSummary.bulanMasuk, keluar: kasSummary.bulanKeluar },
        series: kasSummary.series,
        agenda,
        info,
        rumah: rumah
          ? {
              alamat: rumah.Alamat,
              statusHunian: rumah.StatusHunian,
              pihakPembayar: rumah.PihakPembayarIuran,
            }
          : null,
        iuran: {
          lunas: tunggakan.length === 0,
          tunggakan,
          totalBulan,
          totalNominal,
          menunggu: uniqueMenungguTrx,
        },
      };
    } else {
      // Pengurus Dashboard
      const perStatus: Record<StatusHunian, number> = {
        'Dihuni Pemilik': 0,
        Dikontrakkan: 0,
        Kosong: 0,
      };
      this.db.Rumah.forEach((r) => {
        if (perStatus[r.StatusHunian] !== undefined) {
          perStatus[r.StatusHunian]++;
        }
      });

      let rumahMenunggak = 0;
      let totalTunggakan = 0;
      this.db.Rumah.forEach((r) => {
        const tg = this.getTunggakanRumah(r);
        if (tg.length > 0) {
          rumahMenunggak++;
          tg.forEach((i) => (totalTunggakan += i.subtotal));
        }
      });

      const totalWarga = this.db.Penduduk.length;
      const wargaTinggal = this.db.Keluarga.filter((k) => k.StatusMenghuni === 'Menghuni').length;
      const menungguVerif = this.getGroupedPayments({ status: 'Menunggu Verifikasi' }).length;

      return {
        role: session.role,
        namaRT: st.NamaRT,
        saldo: kasSummary.saldo,
        bulanIni: { masuk: kasSummary.bulanMasuk, keluar: kasSummary.bulanKeluar },
        series: kasSummary.series,
        agenda,
        info,
        ringkas: {
          totalRumah: this.db.Rumah.length,
          totalWarga,
          wargaTinggal,
          perStatus,
          menungguVerifikasi: menungguVerif,
          rumahMenunggak,
          totalTunggakan,
          totalPemasukan: kasSummary.totalMasuk,
          totalPengeluaran: kasSummary.totalKeluar,
        },
      };
    }
  }

  // Agenda
  public listAgenda(filter?: { status?: string; q?: string }) {
    const q = (filter?.q || '').toLowerCase().trim();
    const today = todayStr();
    let rows = [...this.db.Agenda].map((a) => ({
      ...a,
      StatusTampil: a.Status === 'Akan Datang' && a.Tanggal < today ? 'Selesai' : a.Status,
    }));

    if (filter?.status) {
      rows = rows.filter((a) => a.StatusTampil === filter.status);
    }
    if (q) {
      rows = rows.filter((a) => (a.Judul + ' ' + a.Lokasi + ' ' + a.Deskripsi).toLowerCase().includes(q));
    }

    rows.sort((a, b) => b.Tanggal.localeCompare(a.Tanggal));
    return rows;
  }

  public saveAgenda(data: Partial<AgendaRow>, user: string) {
    const judul = (data.Judul || '').trim();
    if (!judul) throw new Error('Judul agenda wajib diisi.');
    const tgl = data.Tanggal || todayStr();

    if (data.ID) {
      const ex = this.db.Agenda.find((a) => a.ID === data.ID);
      if (!ex) throw new Error('Agenda tidak ditemukan.');
      ex.Judul = judul;
      ex.Tanggal = tgl;
      ex.Waktu = data.Waktu || '';
      ex.Lokasi = data.Lokasi || '';
      ex.Deskripsi = data.Deskripsi || '';
      ex.Status = data.Status || 'Akan Datang';
      this.logAction(user, 'UBAH_AGENDA', judul);
      this.persist();
      return { ID: ex.ID };
    } else {
      const newAgenda: AgendaRow = {
        ID: genId('AGD'),
        Judul: judul,
        Tanggal: tgl,
        Waktu: data.Waktu || '',
        Lokasi: data.Lokasi || '',
        Deskripsi: data.Deskripsi || '',
        Status: data.Status || 'Akan Datang',
        DibuatOleh: user,
      };
      this.db.Agenda.push(newAgenda);
      this.logAction(user, 'TAMBAH_AGENDA', judul);
      this.persist();
      return { ID: newAgenda.ID };
    }
  }

  public deleteAgenda(id: string, user: string) {
    const idx = this.db.Agenda.findIndex((a) => a.ID === id);
    if (idx < 0) throw new Error('Agenda tidak ditemukan.');
    const a = this.db.Agenda[idx];
    this.db.Agenda.splice(idx, 1);
    this.logAction(user, 'HAPUS_AGENDA', a.Judul);
    this.persist();
  }

  // Informasi
  public listInfo(filter?: { kategori?: string; status?: string; q?: string }, isWarga = false) {
    const q = (filter?.q || '').toLowerCase().trim();
    let rows = [...this.db.Informasi];

    if (isWarga) {
      rows = rows.filter((i) => i.Status === 'Publish');
    } else if (filter?.status) {
      rows = rows.filter((i) => i.Status === filter.status);
    }

    if (filter?.kategori) {
      rows = rows.filter((i) => i.Kategori === filter.kategori);
    }
    if (q) {
      rows = rows.filter((i) => (i.Judul + ' ' + i.Isi).toLowerCase().includes(q));
    }

    rows.sort((a, b) => b.TanggalTerbit.localeCompare(a.TanggalTerbit));
    return rows;
  }

  public saveInfo(data: Partial<InfoRow>, user: string) {
    const judul = (data.Judul || '').trim();
    if (!judul) throw new Error('Judul informasi wajib diisi.');
    const isi = (data.Isi || '').trim();
    if (!isi) throw new Error('Isi informasi wajib diisi.');

    if (data.ID) {
      const ex = this.db.Informasi.find((i) => i.ID === data.ID);
      if (!ex) throw new Error('Informasi tidak ditemukan.');
      ex.Judul = judul;
      ex.Isi = isi;
      ex.Kategori = data.Kategori || 'Pengumuman';
      ex.TanggalTerbit = data.TanggalTerbit || todayStr();
      ex.Status = data.Status || 'Publish';
      this.logAction(user, 'UBAH_INFO', judul);
      this.persist();
      return { ID: ex.ID };
    } else {
      const newInfo: InfoRow = {
        ID: genId('INF'),
        Judul: judul,
        Isi: isi,
        Kategori: data.Kategori || 'Pengumuman',
        TanggalTerbit: data.TanggalTerbit || todayStr(),
        Status: data.Status || 'Publish',
        DibuatOleh: user,
      };
      this.db.Informasi.push(newInfo);
      this.logAction(user, 'TAMBAH_INFO', judul);
      this.persist();
      return { ID: newInfo.ID };
    }
  }

  public deleteInfo(id: string, user: string) {
    const idx = this.db.Informasi.findIndex((i) => i.ID === id);
    if (idx < 0) throw new Error('Informasi tidak ditemukan.');
    const inf = this.db.Informasi[idx];
    this.db.Informasi.splice(idx, 1);
    this.logAction(user, 'HAPUS_INFO', inf.Judul);
    this.persist();
  }

  // Pengurus
  public listPengurus() {
    return this.db.Pengurus.map((p) => ({
      ID: p.ID,
      Nama: p.Nama,
      Username: p.Username,
      Jabatan: p.Jabatan,
      Role: p.Role,
      Status: p.Status,
      DibuatPada: p.DibuatPada,
    }));
  }

  public savePengurus(
    data: {
      ID?: string;
      Nama: string;
      Username: string;
      Jabatan?: string;
      Role: 'Admin' | 'Ketua' | 'Sekretaris' | 'Bendahara';
      Status: 'Aktif' | 'Nonaktif';
      Password?: string;
    },
    currentUser: UserSession
  ) {
    const nama = (data.Nama || '').trim();
    if (!nama) throw new Error('Nama pengurus wajib diisi.');

    const u = (data.Username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(u)) {
      throw new Error('Username harus 3-30 karakter.');
    }

    const dup = this.db.Pengurus.find((p) => p.Username.toLowerCase() === u && p.ID !== data.ID);
    if (dup) throw new Error(`Username "${u}" sudah digunakan.`);

    if (data.ID) {
      const ex = this.db.Pengurus.find((p) => p.ID === data.ID);
      if (!ex) throw new Error('Akun pengurus tidak ditemukan.');

      ex.Nama = nama;
      ex.Username = u;
      ex.Jabatan = data.Jabatan || data.Role;
      ex.Role = data.Role;
      ex.Status = data.Status;

      if (data.Password && data.Password.trim()) {
        if (data.Password.length < 6) throw new Error('Password minimal 6 karakter.');
        ex.PasswordHash = makePasswordHash(data.Password);
      }

      this.logAction(currentUser.nama, 'UBAH_PENGURUS', `Update akun ${u} (${data.Role})`);
      this.persist();
      return { ID: ex.ID };
    } else {
      if (!data.Password || data.Password.length < 6) {
        throw new Error('Password awal minimal 6 karakter.');
      }

      const newPengurus: PengurusRow = {
        ID: genId('PGR'),
        Nama: nama,
        Username: u,
        PasswordHash: makePasswordHash(data.Password),
        Jabatan: data.Jabatan || data.Role,
        Role: data.Role,
        Status: data.Status,
        DibuatPada: nowStr(),
      };
      this.db.Pengurus.push(newPengurus);
      this.logAction(currentUser.nama, 'TAMBAH_PENGURUS', `Tambah akun ${u} (${data.Role})`);
      this.persist();
      return { ID: newPengurus.ID };
    }
  }

  public resetPasswordPengurus(id: string, newPw: string, user: string) {
    const p = this.db.Pengurus.find((x) => x.ID === id);
    if (!p) throw new Error('Akun tidak ditemukan.');
    if (!newPw || newPw.length < 6) throw new Error('Password baru minimal 6 karakter.');

    p.PasswordHash = makePasswordHash(newPw);
    this.logAction(user, 'RESET_PASSWORD', `Reset password untuk akun: ${p.Username}`);
    this.persist();
  }

  public changeOwnPassword(userId: string, oldPw: string, newPw: string) {
    const p = this.db.Pengurus.find((x) => x.ID === userId);
    if (!p) throw new Error('Akun tidak ditemukan.');

    if (!verifyPassword(oldPw, p.PasswordHash)) {
      throw new Error('Password lama tidak sesuai.');
    }

    if (!newPw || newPw.length < 6) {
      throw new Error('Password baru minimal 6 karakter.');
    }

    p.PasswordHash = makePasswordHash(newPw);
    this.logAction(p.Nama, 'UBAH_PASSWORD_SENDIRI', `Akun ${p.Username} berhasil mengubah password.`);
    this.persist();
  }

  public listLogs(limit = 200) {
    return this.db.LogAktivitas.slice(0, limit);
  }

  public exportSheetCsv(sheetName: keyof SpreadsheetDatabase): string {
    const rows = (this.db[sheetName] || []) as unknown as Record<string, unknown>[];
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]).filter((k) => k !== 'PINHash' && k !== 'PasswordHash');
    const escapeCsv = (val: unknown) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.join(',');
    const dataLines = rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(','));
    return [headerLine, ...dataLines].join('\n');
  }

  public importSheetJson(imported: Partial<SpreadsheetDatabase>, user: string) {
    if (imported.Rumah) this.db.Rumah = imported.Rumah;
    if (imported.Penduduk) this.db.Penduduk = imported.Penduduk;
    if (imported.Keluarga) this.db.Keluarga = imported.Keluarga;
    if (imported.RiwayatHunian) this.db.RiwayatHunian = imported.RiwayatHunian;
    if (imported.Tarif) this.db.Tarif = imported.Tarif;
    if (imported.Pembayaran) this.db.Pembayaran = imported.Pembayaran;
    if (imported.BukuKas) this.db.BukuKas = imported.BukuKas;
    if (imported.Agenda) this.db.Agenda = imported.Agenda;
    if (imported.Informasi) this.db.Informasi = imported.Informasi;
    if (imported.Pengaturan) this.db.Pengaturan = imported.Pengaturan;
    if (imported.Pengurus && imported.Pengurus.length > 0) this.db.Pengurus = imported.Pengurus;
    if (imported.LogAktivitas) this.db.LogAktivitas = imported.LogAktivitas;

    this.logAction(user, 'IMPORT_DATABASE', 'Memulihkan database spreadsheet');
    this.persist();
  }
}

export const dbService = new SpreadsheetStore();
