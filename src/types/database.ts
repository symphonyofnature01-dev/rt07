/**
 * Type definitions for RT 07 GO DIGITAL
 * Relational Spreadsheet Database Structure
 */

export interface PengurusRow {
  ID: string;
  Nama: string;
  Username: string;
  PasswordHash: string;
  Jabatan: string;
  Role: 'Admin' | 'Ketua' | 'Sekretaris' | 'Bendahara';
  Status: 'Aktif' | 'Nonaktif';
  DibuatPada: string;
}

export type StatusHunian = 'Dihuni Pemilik' | 'Dikontrakkan' | 'Kosong';
export type HubunganKeluarga = 'Kepala Keluarga' | 'Istri' | 'Suami' | 'Anak' | 'Lainnya';
export type JenisKelamin = 'Laki-laki' | 'Perempuan';
export type StatusPenduduk = 'Tetap' | 'Sementara';
export type StatusData = 'Aktif' | 'Nonaktif';
export type PeranKeluarga =
  | 'Pemilik'
  | 'Anggota Keluarga Pemilik'
  | 'Penyewa'
  | 'Anggota Keluarga Penyewa';
export type StatusMenghuni = 'Menghuni' | 'Tidak Menghuni';
export type PihakPembayar = 'Pemilik' | 'Penyewa';

// TABEL A: RUMAH
export interface RumahRow {
  ID: string;
  Blok: string;
  Nomor: string;
  Alamat: string; // e.g. "Blok A4/1" or "A4/1"
  StatusHunian: StatusHunian;
  IDPemilik?: string; // Foreign Key ke Penduduk
  IDPenanggungJawabIuran?: string; // Foreign Key ke Penduduk
  PihakPembayarIuran: PihakPembayar;
  KategoriIuran: string; // e.g. "Umum"
  Catatan: string;
  PINHash: string; // untuk login warga
}

// TABEL B: PENDUDUK
export interface PendudukRow {
  ID: string;
  NIK: string; // 16 digit
  NamaLengkap: string;
  JenisKelamin: JenisKelamin;
  TempatLahir: string;
  TanggalLahir: string; // yyyy-mm-dd
  NoHP: string;
  Pekerjaan: string;
  StatusPenduduk: StatusPenduduk; // Tetap / Sementara
  StatusData: StatusData; // Aktif / Nonaktif
}

// TABEL C: KELUARGA / HUBUNGAN KELUARGA
export interface KeluargaRow {
  ID: string;
  IDRumah: string; // FK ke Rumah
  IDPenduduk: string; // FK ke Penduduk
  IDKepalaKeluarga?: string; // FK ke Penduduk (Kepala Keluarga dari kelompok keluarga ini)
  HubunganKeluarga: HubunganKeluarga;
  Peran: PeranKeluarga;
  StatusMenghuni: StatusMenghuni;
}

// TABEL D: RIWAYAT HUNIAN
export interface RiwayatHunianRow {
  ID: string;
  IDRumah: string; // FK ke Rumah
  IDKepalaKeluarga?: string; // FK ke Penduduk
  NamaKeluarga: string; // e.g. "Keluarga Pak Aris" / "Keluarga Pak Bayu"
  JenisHunian: 'Pemilik' | 'Sewa';
  TanggalMulai: string; // yyyy-mm-dd
  TanggalSelesai?: string; // yyyy-mm-dd
  StatusHunian: 'Aktif' | 'Selesai';
  Catatan?: string;
}

// TABEL E: IURAN / PEMBAYARAN
export type StatusPembayaran = 'Menunggu Verifikasi' | 'Terverifikasi' | 'Ditolak';
export type KategoriIuranUtama = 'Iuran Rutin' | 'Iuran Non Rutin';

export interface PembayaranRow {
  ID: string;
  AlamatRumah: string; // FK Alamat Rumah / IDRumah
  JenisIuran: string;
  TipeIuran?: KategoriIuranUtama; // Iuran Rutin | Iuran Non Rutin
  Periode: string; // yyyy-mm
  Tahun?: number;
  Bulan?: number;
  Nominal: number; // Nominal Tagihan / Dibayar
  TanggalBayar: string;
  MetodeBayar: string;
  BuktiURL: string;
  KodeTransaksi: string;
  Status: StatusPembayaran;
  PihakPembayar: PihakPembayar; // Pemilik / Penyewa
  CatatanVerifikator: string;
  DiverifikasiOleh: string;
  TanggalVerifikasi: string;
}

export interface TarifRow {
  ID: string;
  JenisIuran: string;
  TipeIuran?: KategoriIuranUtama; // Iuran Rutin | Iuran Non Rutin
  KategoriIuran: string;
  Nominal: number;
  Status: 'Aktif' | 'Nonaktif';
}

export interface KasRow {
  ID: string;
  Tanggal: string;
  Jenis: 'Pemasukan' | 'Pengeluaran';
  Kategori: string;
  Uraian: string;
  Nominal: number;
  SumberReferensi: string;
  DicatatOleh: string;
  Saldo?: number;
}

export type StatusAgenda = 'Akan Datang' | 'Selesai' | 'Dibatalkan';

export interface AgendaRow {
  ID: string;
  Judul: string;
  Tanggal: string;
  Waktu: string;
  Lokasi: string;
  Deskripsi: string;
  Status: StatusAgenda;
  DibuatOleh: string;
}

export interface InfoRow {
  ID: string;
  Judul: string;
  Isi: string;
  Kategori: 'Pengumuman' | 'Keuangan' | 'Keamanan' | 'Lainnya';
  TanggalTerbit: string;
  Status: 'Publish' | 'Draft';
  DibuatOleh: string;
}

export interface SettingRow {
  Kunci: string;
  Nilai: string;
}

export interface LogRow {
  Waktu: string;
  User: string;
  Aksi: string;
  Detail: string;
}

// SPREADSHEET DATABASE CONTAINER
export interface SpreadsheetDatabase {
  Rumah: RumahRow[];
  Penduduk: PendudukRow[];
  Keluarga: KeluargaRow[];
  RiwayatHunian: RiwayatHunianRow[];
  Pembayaran: PembayaranRow[];
  BukuKas: KasRow[];
  Tarif: TarifRow[];
  Agenda: AgendaRow[];
  Informasi: InfoRow[];
  Pengurus: PengurusRow[];
  Pengaturan: SettingRow[];
  LogAktivitas: LogRow[];
}

// Joined View Models
export interface AnggotaKeluargaDetail {
  keluarga: KeluargaRow;
  penduduk: PendudukRow;
}

export interface RumahDetailView {
  rumah: RumahRow;
  pemilik?: PendudukRow;
  penanggungJawab?: PendudukRow;
  keluargaPemilik: AnggotaKeluargaDetail[];
  keluargaPenyewa: AnggotaKeluargaDetail[];
  semuaAnggota: AnggotaKeluargaDetail[];
  penghuniAktif: AnggotaKeluargaDetail[];
  riwayatHunian: RiwayatHunianRow[];
  kepalaKeluargaAktif?: PendudukRow;
  kontakPenghuniAktif?: string;
  jumlahJiwaTinggal: number;
  jumlahJiwaTotal: number;
}

export interface UserPermissions {
  pengurus: boolean;
  ubahData: boolean;
  ubahKeuangan: boolean;
  admin: boolean;
}

export interface UserSession {
  type: 'warga' | 'pengurus';
  id?: string;
  nama: string;
  username?: string;
  role: 'Admin' | 'Ketua' | 'Sekretaris' | 'Bendahara' | 'Warga';
  jabatan?: string;
  alamat?: string;
  perm: UserPermissions;
}

export interface PublicInfo {
  namaAplikasi: string;
  namaRT: string;
  alamatRT: string;
  pinWargaAktif: boolean;
  daftarAlamat: string[];
}

export interface TunggakanItem {
  jenis: string;
  tipeIuran?: KategoriIuranUtama;
  nominal: number;
  periode: string[];
  jumlah: number;
  subtotal: number;
}

export interface TunggakanRumah {
  alamat: string;
  statusHunian: StatusHunian;
  kepala: string;
  pihakPembayar: PihakPembayar;
  noHP: string;
  items: TunggakanItem[];
  totalBulan: number;
  totalNominal: number;
  pesan: string;
}

export interface GroupedPayment {
  kode: string;
  alamat: string;
  jenis: string;
  tipeIuran: KategoriIuranUtama;
  periode: string[];
  ids: string[];
  total: number;
  tanggalBayar: string;
  metode: string;
  adaBukti: boolean;
  buktiURL?: string;
  status: StatusPembayaran;
  pihakPembayar: PihakPembayar;
  catatan: string;
  diverifikasiOleh: string;
  tanggalVerifikasi: string;
}
