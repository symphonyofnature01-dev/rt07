import React, { useState } from 'react';
import { dbService } from '../services/spreadsheetDb';
import { PengurusRow, SpreadsheetDatabase, UserSession } from '../types/database';
import { Modal } from '../components/Modal';
import { SpreadsheetConnectionPanel } from '../components/SpreadsheetConnectionPanel';
import { useToast } from '../components/Toast';
import {
  Users,
  Settings,
  FileSpreadsheet,
  History,
  Plus,
  Edit2,
  KeyRound,
  Download,
  Upload,
  RefreshCw,
} from 'lucide-react';

interface AdminViewProps {
  session: UserSession;
}

export const AdminView: React.FC<AdminViewProps> = ({ session }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'pengurus' | 'settings' | 'spreadsheet' | 'logs'>('pengurus');
  const [, setRevision] = useState(0);

  // TAB 1: PENGURUS STATE
  const pengurusList = dbService.listPengurus();
  const [pengurusModal, setPengurusModal] = useState<{
    ID?: string;
    Nama: string;
    Username: string;
    Jabatan: string;
    Role: 'Admin' | 'Ketua' | 'Sekretaris' | 'Bendahara';
    Status: 'Aktif' | 'Nonaktif';
    Password?: string;
  } | null>(null);

  const [resetPwModal, setResetPwModal] = useState<{ id: string; username: string; newPw: string } | null>(null);

  // TAB 2: SETTINGS STATE
  const [settingsData, setSettingsData] = useState(() => dbService.getSettings());

  // TAB 3: SPREADSHEET BROWSER STATE
  const rawDb = dbService.getRawDatabase();
  const legacyMigration = dbService.getLegacyMigrationSummary();
  const sheetNames: (keyof SpreadsheetDatabase)[] = [
    'Pengurus',
    'Rumah',
    'Penduduk',
    'Keluarga',
    'RiwayatHunian',
    'Pembayaran',
    'BukuKas',
    'Tarif',
    'Agenda',
    'Informasi',
    'Pengaturan',
    'LogAktivitas',
  ];
  const [activeSheet, setActiveSheet] = useState<keyof SpreadsheetDatabase>('Rumah');
  const [sheetSearch, setSheetSearch] = useState('');

  // TAB 4: LOGS STATE
  const logsList = dbService.listLogs(300);

  // -------------------------
  // Handlers for Tab 1: Pengurus
  // -------------------------
  const handleSavePengurusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pengurusModal) return;
    try {
      dbService.savePengurus(pengurusModal, session);
      await dbService.waitForRemoteSync();
      toast(pengurusModal.ID ? 'Akun pengurus berhasil diperbarui.' : 'Akun pengurus baru berhasil ditambahkan.', 'success');
      setPengurusModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwModal) return;
    try {
      dbService.resetPasswordPengurus(resetPwModal.id, resetPwModal.newPw, session.nama);
      await dbService.waitForRemoteSync();
      toast(`Password untuk ${resetPwModal.username} berhasil direset.`, 'success');
      setResetPwModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  // -------------------------
  // Handlers for Tab 2: Settings
  // -------------------------
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      dbService.saveSettings(settingsData, session.nama);
      await dbService.waitForRemoteSync();
      toast('Pengaturan RT berhasil disimpan.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  // -------------------------
  // Handlers for Tab 3: Spreadsheet
  // -------------------------
  const handleDownloadSheetCsv = (sheet: keyof SpreadsheetDatabase) => {
    const csv = dbService.exportSheetCsv(sheet);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RT07_${sheet}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Sheet ${sheet} berhasil diunduh dalam format CSV.`, 'success');
  };

  const handleDownloadFullJson = () => {
    const full = dbService.getRawDatabase();
    const str = JSON.stringify(full, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RT07_Database_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Backup seluruh database spreadsheet berhasil diunduh.', 'success');
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const requiredSheets: (keyof SpreadsheetDatabase)[] = ['Rumah', 'Penduduk', 'Keluarga', 'RiwayatHunian', 'Pembayaran', 'BukuKas', 'Tarif', 'Agenda', 'Informasi', 'Pengurus', 'Pengaturan', 'LogAktivitas'];
        if (!requiredSheets.every((sheet) => Array.isArray(parsed[sheet]))) {
          throw new Error('Berkas harus merupakan backup database lengkap; impor parsial ditolak agar data Spreadsheet tidak terhapus.');
        }
        if (window.confirm('Pulihkan database dari berkas ini? Seluruh data saat ini akan ditimpa.')) {
          dbService.importSheetJson(parsed, session.nama);
          await dbService.waitForRemoteSync();
          toast('Database berhasil dipulihkan. Keluar lalu login kembali untuk mengganti password Admin.', 'success');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast(`Gagal impor: ${msg}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleResetToDefault = async () => {
    if (
      window.confirm(
        'PERINGATAN: Apakah Anda yakin ingin mengosongkan dan mereset seluruh database ke kondisi awal?'
      )
    ) {
      dbService.resetDatabase();
      await dbService.waitForRemoteSync();
      toast('Database telah dikosongkan ke kondisi awal.', 'success');
    }
  };

  const handleMigrateLegacyData = async () => {
    if (!window.confirm(`Migrasikan ${legacyMigration.rows} data lama dari browser ke Google Sheets? Data yang sudah ada di Spreadsheet tidak akan ditimpa.`)) return;
    try {
      await dbService.migrateLegacyData(session.nama);
      setRevision((value) => value + 1);
      toast('Data lama berhasil dimigrasikan ke Google Sheets.', 'success');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  // Current sheet data
  const currentSheetRows = (rawDb[activeSheet] || []) as unknown as Record<string, unknown>[];
  const sheetHeaders = currentSheetRows.length > 0 ? Object.keys(currentSheetRows[0]) : [];

  const filteredSheetRows = currentSheetRows.filter((r) => {
    if (!sheetSearch) return true;
    const q = sheetSearch.toLowerCase();
    return Object.values(r).some((v) => String(v || '').toLowerCase().includes(q));
  });

  return (
    <div className="space-y-5">
      {legacyMigration.available && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-amber-900 flex-1">Ditemukan {legacyMigration.rows} data lama di browser. Migrasikan sekali agar Google Sheets menjadi sumber data utama.</p>
          <button type="button" onClick={handleMigrateLegacyData} className="px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-semibold">Migrasikan Data Lama</button>
        </div>
      )}
      {/* Page Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Panel Administrator RT
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Pengaturan hak akses pengurus, konfigurasi rekening RT, dan manajemen spreadsheet database
        </p>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto p-1 bg-slate-100 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('pengurus')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'pengurus'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Akun Pengurus</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'settings'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Pengaturan RT</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('spreadsheet')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'spreadsheet'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Database Spreadsheet</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'logs'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Log Aktivitas</span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: AKUN PENGURUS (Strictly Username & Password)
      ======================================================== */}
      {activeTab === 'pengurus' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Daftar Akun Pengurus RT (Username & Password)
              </h3>
              <p className="text-xs text-slate-500">
                Pengurus masuk menggunakan username dan password mandiri. Tanpa login Google.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setPengurusModal({
                  Nama: '',
                  Username: '',
                  Jabatan: 'Bendahara RT 07',
                  Role: 'Bendahara',
                  Status: 'Aktif',
                  Password: '',
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Akun Pengurus</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Nama Lengkap</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Jabatan</th>
                    <th className="px-4 py-3">Role Akses</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pengurusList.map((p) => (
                    <tr key={p.ID} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{p.Nama}</td>
                      <td className="px-4 py-3 font-mono text-slate-700 font-medium">@{p.Username}</td>
                      <td className="px-4 py-3 text-slate-600">{p.Jabatan}</td>
                      <td className="px-4 py-3 font-medium">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          {p.Role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            p.Status === 'Aktif'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {p.Status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setPengurusModal({
                              ID: p.ID,
                              Nama: p.Nama,
                              Username: p.Username,
                              Jabatan: p.Jabatan,
                              Role: p.Role,
                              Status: p.Status,
                            })
                          }
                          className="p-1.5 text-slate-600 hover:text-emerald-700 rounded-lg hover:bg-slate-100 transition-colors mr-1 cursor-pointer"
                          title="Ubah Profil Pengurus"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setResetPwModal({
                              id: p.ID,
                              username: p.Username,
                              newPw: '',
                            })
                          }
                          className="p-1.5 text-slate-600 hover:text-amber-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: PENGATURAN RT
      ======================================================== */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Konfigurasi Sistem & Rekening RT</h3>
            <p className="text-xs text-slate-500">Atur profil RT dan tujuan transfer pembayaran iuran warga</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Aplikasi *</label>
              <input
                type="text"
                required
                value={settingsData.NamaAplikasi || ''}
                onChange={(e) => setSettingsData({ ...settingsData, NamaAplikasi: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama RT *</label>
              <input
                type="text"
                required
                value={settingsData.NamaRT || ''}
                onChange={(e) => setSettingsData({ ...settingsData, NamaRT: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat RT / Perumahan</label>
            <input
              type="text"
              value={settingsData.AlamatRT || ''}
              onChange={(e) => setSettingsData({ ...settingsData, AlamatRT: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h4 className="font-semibold text-slate-800 text-xs sm:text-sm mb-2">Rekening Kas RT (Tujuan Transfer)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Bank</label>
                <input
                  type="text"
                  value={settingsData.RekeningBank || ''}
                  onChange={(e) => setSettingsData({ ...settingsData, RekeningBank: e.target.value })}
                  placeholder="Bank BCA / Mandiri / BRI / BSI"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nomor Rekening</label>
                <input
                  type="text"
                  value={settingsData.RekeningNomor || ''}
                  onChange={(e) => setSettingsData({ ...settingsData, RekeningNomor: e.target.value })}
                  placeholder="8820xxxxxx"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Atas Nama Rekening</label>
                <input
                  type="text"
                  value={settingsData.RekeningAtasNama || ''}
                  onChange={(e) => setSettingsData({ ...settingsData, RekeningAtasNama: e.target.value })}
                  placeholder="Bendahara RT 07"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h4 className="font-semibold text-slate-800 text-xs sm:text-sm mb-1">
              Setup Besaran Iuran RT (Rutin & Non Rutin)
            </h4>
            <p className="text-[11px] text-slate-500 mb-3">
              Menetapkan nominal standar untuk kategori Iuran Rutin (tagihan bulanan) dan Iuran Non Rutin (insidental). Nilai &gt; 0 akan otomatis aktif pada menu Tarif & Pembayaran.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Besar Iuran Rutin per Bulan (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={settingsData.NominalIuranRutin ?? '0'}
                  onChange={(e) => setSettingsData({ ...settingsData, NominalIuranRutin: e.target.value })}
                  placeholder="Contoh: 50000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono font-semibold"
                />
                <span className="text-[11px] text-emerald-700 mt-1 block font-medium">
                  Tagihan rutin bulanan per rumah
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Besar Iuran Non Rutin (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={settingsData.NominalIuranNonRutin ?? '0'}
                  onChange={(e) => setSettingsData({ ...settingsData, NominalIuranNonRutin: e.target.value })}
                  placeholder="Contoh: 100000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono font-semibold"
                />
                <span className="text-[11px] text-indigo-700 mt-1 block font-medium">
                  Iuran insidental / kegiatan khusus
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Periode Mulai Tagihan Iuran (yyyy-mm) *
              </label>
              <input
                type="month"
                required
                value={settingsData.MulaiIuran || '2026-01'}
                onChange={(e) => setSettingsData({ ...settingsData, MulaiIuran: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Bulan awal mulainya perhitungan tunggakan iuran rutin
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                PIN Login Warga *
              </label>
              <select
                value={settingsData.PinWargaAktif || 'TIDAK'}
                onChange={(e) => setSettingsData({ ...settingsData, PinWargaAktif: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="TIDAK">Nonaktif (Warga cukup pilih alamat rumah)</option>
                <option value="YA">Aktif (Wajib memasukkan PIN per rumah)</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Jika aktif, buat PIN tiap rumah melalui menu Warga & Rumah.
              </span>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs"
            >
              Simpan Pengaturan
            </button>
          </div>
        </form>
      )}

      {/* ========================================================
          TAB 3: DATABASE SPREADSHEET BROWSER & CONNECTOR
      ======================================================== */}
      {activeTab === 'spreadsheet' && (
        <div className="space-y-4">
          <SpreadsheetConnectionPanel session={session} />

          {/* Action Header Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Pusat Data Spreadsheet RT 07</span>
              </h3>
              <p className="text-xs text-slate-500">
                Seluruh {sheetNames.length} lembar sheet tersimpan rapi dalam format spreadsheet tabular.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadFullJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                title="Cadangkan seluruh database"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Backup JSON</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Pulihkan JSON</span>
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleImportJsonFile}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleResetToDefault}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                title="Reset ke data awal"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Awal</span>
              </button>
            </div>
          </div>

          {/* Sheet Selector Tabs */}
          <div className="flex overflow-x-auto p-1 bg-slate-100 rounded-2xl gap-1 scrollbar-none">
            {sheetNames.map((sn) => {
              const rowCount = (rawDb[sn] || []).length;
              return (
                <button
                  key={sn}
                  type="button"
                  onClick={() => {
                    setActiveSheet(sn);
                    setSheetSearch('');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    activeSheet === sn
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{sn}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      activeSheet === sn ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {rowCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Current Sheet Viewer & CSV export */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-800 text-xs sm:text-sm">
                  Lembar: <span className="font-mono text-emerald-800 font-bold">{activeSheet}</span>
                </span>
                <span className="text-xs text-slate-400">
                  ({filteredSheetRows.length} dari {currentSheetRows.length} baris)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={sheetSearch}
                  onChange={(e) => setSheetSearch(e.target.value)}
                  placeholder="Cari dalam sheet..."
                  className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />

                <button
                  type="button"
                  onClick={() => handleDownloadSheetCsv(activeSheet)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Unduh CSV</span>
                </button>
              </div>
            </div>

            {/* Sheet Table */}
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 text-slate-600 uppercase font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 w-12 text-slate-400">#</th>
                    {sheetHeaders.map((h) => (
                      <th key={h} className="px-3 py-2 font-mono whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {filteredSheetRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="px-3 py-1.5 text-slate-400">{idx + 1}</td>
                      {sheetHeaders.map((h) => {
                        const val = row[h];
                        const isSecret = h === 'PINHash' || h === 'PasswordHash';
                        return (
                          <td key={h} className="px-3 py-1.5 text-slate-700 max-w-xs truncate whitespace-nowrap">
                            {isSecret ? (
                              <span className="text-slate-400 font-sans italic">[Tersandi]</span>
                            ) : val !== null && val !== undefined ? (
                              String(val)
                            ) : (
                              ''
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {filteredSheetRows.length === 0 && (
                    <tr>
                      <td colSpan={sheetHeaders.length + 1} className="px-4 py-8 text-center text-slate-400 font-sans">
                        Tidak ada baris data pada lembar ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================
          TAB 4: LOG AKTIVITAS
      ======================================================== */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">Audit Trail & Log Aktivitas</h3>
              <p className="text-xs text-slate-500">Rekam jejak setiap perubahan data di database spreadsheet</p>
            </div>
            <span className="text-xs font-mono text-slate-400">{logsList.length} rekaman</span>
          </div>

          <div className="overflow-x-auto max-h-[550px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Pengguna</th>
                  <th className="px-4 py-3">Aksi</th>
                  <th className="px-4 py-3">Rincian Perubahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logsList.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-mono text-slate-500 whitespace-nowrap">{l.Waktu}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{l.User}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-semibold text-[10px]">
                        {l.Aksi}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-md truncate" title={l.Detail}>
                      {l.Detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          MODALS
      ======================================================== */}
      {/* PENGURUS MODAL */}
      {pengurusModal && (
        <Modal
          isOpen={Boolean(pengurusModal)}
          onClose={() => setPengurusModal(null)}
          title={pengurusModal.ID ? 'Ubah Akun Pengurus' : 'Tambah Akun Pengurus Baru'}
          maxWidth="md"
        >
          <form onSubmit={handleSavePengurusSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap *</label>
              <input
                type="text"
                required
                value={pengurusModal.Nama}
                onChange={(e) => setPengurusModal({ ...pengurusModal, Nama: e.target.value })}
                placeholder="Nama pengurus"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Username (3-30 karakter) *
              </label>
              <input
                type="text"
                required
                pattern="^[a-z0-9._-]{3,30}$"
                value={pengurusModal.Username}
                onChange={(e) =>
                  setPengurusModal({
                    ...pengurusModal,
                    Username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''),
                  })
                }
                placeholder="huruf kecil, angka, titik"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Role Akses *</label>
                <select
                  value={pengurusModal.Role}
                  onChange={(e) =>
                    setPengurusModal({
                      ...pengurusModal,
                      Role: e.target.value as 'Admin' | 'Ketua' | 'Sekretaris' | 'Bendahara',
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="Admin">Admin (Semua Akses)</option>
                  <option value="Ketua">Ketua RT</option>
                  <option value="Bendahara">Bendahara (Keuangan & Kas)</option>
                  <option value="Sekretaris">Sekretaris (Warga & Agenda)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status Akun *</label>
                <select
                  value={pengurusModal.Status}
                  onChange={(e) =>
                    setPengurusModal({
                      ...pengurusModal,
                      Status: e.target.value as 'Aktif' | 'Nonaktif',
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jabatan Tampil</label>
              <input
                type="text"
                value={pengurusModal.Jabatan}
                onChange={(e) => setPengurusModal({ ...pengurusModal, Jabatan: e.target.value })}
                placeholder="Contoh: Bendahara RT 07 / Seksi Keamanan"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {pengurusModal.ID ? 'Password Baru (Kosongkan bila tidak diubah)' : 'Password Awal (Min. 6 Karakter) *'}
              </label>
              <input
                type="password"
                required={!pengurusModal.ID}
                minLength={6}
                value={pengurusModal.Password || ''}
                onChange={(e) => setPengurusModal({ ...pengurusModal, Password: e.target.value })}
                placeholder="Minimal 6 karakter"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPengurusModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Simpan Akun
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPwModal && (
        <Modal
          isOpen={Boolean(resetPwModal)}
          onClose={() => setResetPwModal(null)}
          title={`Reset Password: @${resetPwModal.username}`}
          maxWidth="sm"
        >
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Password Baru (Min. 6 Karakter) *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={resetPwModal.newPw}
                onChange={(e) => setResetPwModal({ ...resetPwModal, newPw: e.target.value })}
                placeholder="Masukkan password baru"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setResetPwModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Reset Password
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
