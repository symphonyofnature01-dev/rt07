import React, { useState } from 'react';
import { dbService, formatRupiah, formatTanggalIndo, periodeLabel, pad2, MS } from '../services/spreadsheetDb';
import { KasRow, KategoriIuranUtama, TarifRow, UserSession } from '../types/database';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import {
  Coins,
  CheckCircle2,
  TableProperties,
  AlertTriangle,
  Sliders,
  Plus,
  Search,
  Download,
  Trash2,
  Eye,
  Check,
  X,
  MessageSquare,
  ExternalLink,
  Edit2,
} from 'lucide-react';

interface KasIuranViewProps {
  session: UserSession;
  initialTab?: string;
  onOpenRiwayat: (alamat: string) => void;
  onOpenCatatBayarManual?: () => void;
}

export const KasIuranView: React.FC<KasIuranViewProps> = ({
  session,
  initialTab = 'buku',
  onOpenRiwayat,
  onOpenCatatBayarManual,
}) => {
  const { toast } = useToast();
  const perm = session.perm;

  const [activeTab, setActiveTab] = useState<'buku' | 'verif' | 'matriks' | 'tunggak' | 'tarif'>(
    (initialTab as 'buku' | 'verif' | 'matriks' | 'tunggak' | 'tarif') || 'buku'
  );

  // TAB 1: BUKU KAS STATE
  const [kasDari, setKasDari] = useState('');
  const [kasSampai, setKasSampai] = useState('');
  const [kasJenis, setKasJenis] = useState('');
  const [kasKategori, setKasKategori] = useState('');
  const [kasQuery, setKasQuery] = useState('');
  const [kasModal, setKasModal] = useState<Partial<KasRow> | null>(null);

  // TAB 2: VERIFIKASI STATE
  const [verifStatus, setVerifStatus] = useState<string>('Menunggu Verifikasi');
  const [verifKategori, setVerifKategori] = useState<'' | KategoriIuranUtama>('');
  const [verifQuery, setVerifQuery] = useState('');
  const [buktiModal, setBuktiModal] = useState<{ kode: string; url: string; alamat: string } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ kode: string; alasan: string } | null>(null);

  // TAB 3: MATRIKS STATE
  const currentYear = new Date().getFullYear();
  const [matriksTahun, setMatriksTahun] = useState<number>(currentYear);
  const [matriksKategori, setMatriksKategori] = useState<KategoriIuranUtama>('Iuran Rutin');
  const [matriksJenis, setMatriksJenis] = useState<string>('');

  // TAB 5: TARIF STATE
  const [tarifFilterKategori, setTarifFilterKategori] = useState<'' | KategoriIuranUtama>('');
  const [tarifModal, setTarifModal] = useState<Partial<TarifRow> | null>(null);

  // -------------------------
  // Handlers for Tab 1: Buku Kas
  // -------------------------
  const kasData = dbService.listKas({
    dari: kasDari,
    sampai: kasSampai,
    jenis: kasJenis,
    kategori: kasKategori,
    q: kasQuery,
  });

  const handleExportKasCsv = () => {
    const csv = dbService.exportSheetCsv('BukuKas');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'buku-kas-rt07.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Buku Kas berhasil diekspor ke CSV.', 'success');
  };

  const handleSaveKasSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kasModal) return;
    try {
      dbService.saveKas(kasModal, session.nama);
      toast(kasModal.ID ? 'Transaksi kas diperbarui.' : 'Transaksi kas berhasil dicatat.', 'success');
      setKasModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  const handleDeleteKas = (id: string) => {
    if (!window.confirm('Hapus catatan transaksi kas ini?')) return;
    try {
      dbService.deleteKas(id, session.nama);
      toast('Transaksi kas berhasil dihapus.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  // -------------------------
  // Handlers for Tab 2: Verifikasi Pembayaran
  // -------------------------
  const groupedPayments = dbService.getGroupedPayments({
    status: verifStatus || undefined,
    tipeIuran: verifKategori || undefined,
    q: verifQuery,
  });

  const handleApprovePayment = (kode: string) => {
    if (!window.confirm(`Terima pembayaran transaksi ${kode}? Pembayaran akan otomatis dicatat sebagai pemasukan di Buku Kas.`)) return;
    try {
      dbService.verifyPayment(kode, 'terima', '', session.nama);
      toast(`Pembayaran ${kode} telah diterima dan tercatat di Buku Kas.`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  const handleRejectPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModal) return;
    try {
      dbService.verifyPayment(rejectModal.kode, 'tolak', rejectModal.alasan, session.nama);
      toast(`Pembayaran ${rejectModal.kode} ditolak.`, 'success');
      setRejectModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  const handleDeletePayment = (kode: string) => {
    if (!window.confirm(`Hapus transaksi pembayaran ${kode} beserta seluruh entri kasnya? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      dbService.deletePayment(kode, session.nama);
      toast(`Transaksi ${kode} berhasil dihapus.`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  // -------------------------
  // Handlers for Tab 3: Matriks Iuran
  // -------------------------
  const matriksData = dbService.getMatriks(matriksTahun, matriksJenis);

  // -------------------------
  // Handlers for Tab 4: Rekap Tunggakan
  // -------------------------
  const tunggakanData = dbService.getRekapTunggakan();

  const handleCopyWaText = (pesan: string) => {
    navigator.clipboard.writeText(pesan).then(
      () => toast('Teks pesan WhatsApp berhasil disalin!', 'success'),
      () => toast('Gagal menyalin pesan.', 'error')
    );
  };

  // -------------------------
  // Handlers for Tab 5: Tarif
  // -------------------------
  const tarifData = dbService.listTarif(tarifFilterKategori || undefined);

  const handleSaveTarifSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarifModal) return;
    try {
      dbService.saveTarif(tarifModal, session.nama);
      toast(tarifModal.ID ? 'Tarif iuran diperbarui.' : 'Tarif iuran baru ditambahkan.', 'success');
      setTarifModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  const handleDeleteTarif = (id: string) => {
    if (!window.confirm('Hapus tarif iuran ini? Riwayat pembayaran yang sudah ada tidak akan berubah.')) return;
    try {
      dbService.deleteTarif(id, session.nama);
      toast('Tarif iuran berhasil dihapus.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Buku Kas & Iuran Warga
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Pengelolaan arus keuangan, verifikasi bukti transfer, matriks pembayaran, dan tarif RT
          </p>
        </div>

        {perm.ubahKeuangan && (
          <div className="flex items-center gap-2">
            {onOpenCatatBayarManual && (
              <button
                type="button"
                onClick={onOpenCatatBayarManual}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Catat Pembayaran</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex overflow-x-auto p-1 bg-slate-100 rounded-2xl gap-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('buku')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'buku'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Buku Kas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('verif')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'verif'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Verifikasi Iuran</span>
          {dbService.getGroupedPayments({ status: 'Menunggu Verifikasi' }).length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matriks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'matriks'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TableProperties className="w-4 h-4" />
          <span>Matriks & Rekap Iuran</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tunggak')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'tunggak'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Rekap Tunggakan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tarif')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'tarif'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Tarif Iuran</span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: BUKU KAS
      ======================================================== */}
      {activeTab === 'buku' && (
        <div className="space-y-4">
          {/* Summary Stat Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                Total Pemasukan (Filter)
              </span>
              <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-600">
                {formatRupiah(kasData.totalMasuk)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                Total Pengeluaran (Filter)
              </span>
              <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-rose-600">
                {formatRupiah(kasData.totalKeluar)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                Selisih Arus Kas
              </span>
              <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-800">
                {formatRupiah(kasData.selisih)}
              </div>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80">
              <span className="text-xs text-emerald-800 font-semibold uppercase tracking-wider block mb-1">
                Saldo Kas Keseluruhan
              </span>
              <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-900">
                {formatRupiah(kasData.saldoAkhir)}
              </div>
            </div>
          </div>

          {/* Filter & Action Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Query search */}
              <div className="relative min-w-[160px] flex-1 sm:flex-none">
                <input
                  type="text"
                  value={kasQuery}
                  onChange={(e) => setKasQuery(e.target.value)}
                  placeholder="Cari uraian transaksi..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Jenis filter */}
              <select
                value={kasJenis}
                onChange={(e) => setKasJenis(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700"
              >
                <option value="">Semua Jenis</option>
                <option value="Pemasukan">Pemasukan</option>
                <option value="Pengeluaran">Pengeluaran</option>
              </select>

              {/* Kategori filter */}
              <select
                value={kasKategori}
                onChange={(e) => setKasKategori(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 max-w-[150px]"
              >
                <option value="">Semua Kategori</option>
                {kasData.kategori.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>

              {/* Dari tanggal */}
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span>Dari:</span>
                <input
                  type="date"
                  value={kasDari}
                  onChange={(e) => setKasDari(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs text-slate-700"
                />
              </div>

              {/* Sampai tanggal */}
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span>S/d:</span>
                <input
                  type="date"
                  value={kasSampai}
                  onChange={(e) => setKasSampai(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs text-slate-700"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {perm.ubahKeuangan && (
                <button
                  type="button"
                  onClick={() =>
                    setKasModal({
                      Tanggal: new Date().toISOString().slice(0, 10),
                      Jenis: 'Pengeluaran',
                      Nominal: 0,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Catat Transaksi</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportKasCsv}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Table of Kas Entries */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Jenis</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Uraian Transaksi</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                    <th className="px-4 py-3 text-right">Saldo Kas</th>
                    {perm.ubahKeuangan && <th className="px-4 py-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kasData.rows.map((k) => {
                    const isMasuk = k.Jenis === 'Pemasukan';
                    return (
                      <tr key={k.ID} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap text-slate-600">
                          {formatTanggalIndo(k.Tanggal)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                              isMasuk
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                            }`}
                          >
                            {k.Jenis}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                          {k.Kategori}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 max-w-sm truncate" title={k.Uraian}>
                          {k.Uraian}
                          {k.SumberReferensi && (
                            <span className="ml-1.5 text-[10px] text-slate-400 font-mono italic">
                              (iuran warga)
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                            isMasuk ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isMasuk ? '+' : '-'} {formatRupiah(k.Nominal)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-800 font-medium whitespace-nowrap">
                          {k.Saldo !== undefined ? formatRupiah(k.Saldo) : '-'}
                        </td>
                        {perm.ubahKeuangan && (
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            {!k.SumberReferensi ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setKasModal({ ...k })}
                                  className="p-1 text-slate-500 hover:text-emerald-700 rounded transition-colors"
                                  title="Ubah Kas"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteKas(k.ID)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                  title="Hapus Kas"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">auto</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {kasData.rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                        Tidak ada transaksi kas yang sesuai filter.
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
          TAB 2: VERIFIKASI PEMBAYARAN
      ======================================================== */}
      {activeTab === 'verif' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <select
                value={verifStatus}
                onChange={(e) => setVerifStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                <option value="Terverifikasi">Terverifikasi (Diterima)</option>
                <option value="Ditolak">Ditolak</option>
                <option value="">Semua Status Transaksi</option>
              </select>

              <select
                value={verifKategori}
                onChange={(e) => setVerifKategori(e.target.value as '' | KategoriIuranUtama)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="">Semua Kategori Iuran</option>
                <option value="Iuran Rutin">Iuran Rutin</option>
                <option value="Iuran Non Rutin">Iuran Non Rutin</option>
              </select>

              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <input
                  type="text"
                  value={verifQuery}
                  onChange={(e) => setVerifQuery(e.target.value)}
                  placeholder="Cari kode transaksi, alamat..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {perm.ubahKeuangan && onOpenCatatBayarManual && (
              <button
                type="button"
                onClick={onOpenCatatBayarManual}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                + Catat Pembayaran Manual
              </button>
            )}
          </div>

          {/* Cards of Grouped Payments */}
          {groupedPayments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedPayments.map((p) => {
                const statusColor =
                  p.status === 'Terverifikasi'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : p.status === 'Menunggu Verifikasi'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-rose-100 text-rose-800 border-rose-200';

                return (
                  <div
                    key={p.kode}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="font-bold text-slate-900 text-base block">
                            Rumah {p.alamat}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {p.kode}
                          </span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${statusColor}`}>
                          {p.status}
                        </span>
                      </div>

                      {/* Detail */}
                      <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 my-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400">Kategori:</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                              p.tipeIuran === 'Iuran Non Rutin'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-sky-50 text-sky-800 border-sky-200'
                            }`}
                          >
                            {p.tipeIuran}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Jenis Iuran:</span>
                          <span className="font-semibold text-slate-800">{p.jenis}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Total Pembayaran:</span>
                          <span className="font-mono tabular-nums font-bold text-emerald-700">
                            {formatRupiah(p.total)}
                          </span>
                        </div>
                        {p.tipeIuran === 'Iuran Non Rutin' ? (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Periode Tagihan:</span>
                            <span className="font-medium text-slate-800 text-[11px]">
                              Insidental ({formatTanggalIndo(p.tanggalBayar)})
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-slate-400 block mb-0.5">Bulan Dibayar ({p.periode.length} bln):</span>
                            <span className="font-medium text-slate-800 block text-[11px] leading-tight">
                              {p.periode.map(periodeLabel).join(', ')}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/40">
                          <span className="text-slate-400">Tanggal Bayar:</span>
                          <span>{formatTanggalIndo(p.tanggalBayar)} ({p.metode})</span>
                        </div>
                        {p.catatan && (
                          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/40">
                            <span className="font-semibold">Catatan:</span> {p.catatan}
                          </div>
                        )}
                        {p.diverifikasiOleh && (
                          <div className="text-[10px] text-slate-400 pt-1">
                            Diverifikasi oleh: {p.diverifikasiOleh}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        {p.adaBukti && p.buktiURL ? (
                          <button
                            type="button"
                            onClick={() =>
                              setBuktiModal({
                                kode: p.kode,
                                url: p.buktiURL!,
                                alamat: p.alamat,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat Bukti</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Tanpa lampiran</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {perm.ubahKeuangan && p.status === 'Menunggu Verifikasi' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprovePayment(p.kode)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Terima Pembayaran"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Terima</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRejectModal({ kode: p.kode, alasan: '' })}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Tolak Pembayaran"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Tolak</span>
                            </button>
                          </>
                        )}

                        {perm.ubahKeuangan && (
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(p.kode)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Hapus Transaksi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">Tidak ada transaksi pembayaran pada status ini.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 3: MATRIKS & REKAP IURAN
      ======================================================== */}
      {activeTab === 'matriks' && (
        <div className="space-y-4">
          {/* Category, Year & Fee Type Switcher */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-0.5">Kategori Iuran</label>
                <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/70">
                  <button
                    type="button"
                    onClick={() => setMatriksKategori('Iuran Rutin')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      matriksKategori === 'Iuran Rutin'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Iuran Rutin (12 Bln)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatriksKategori('Iuran Non Rutin')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      matriksKategori === 'Iuran Non Rutin'
                        ? 'bg-white text-amber-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Iuran Non Rutin
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-0.5">Tahun Iuran</label>
                <select
                  value={matriksTahun}
                  onChange={(e) => setMatriksTahun(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                >
                  {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {matriksKategori === 'Iuran Rutin' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-0.5">Jenis Iuran Rutin</label>
                  <select
                    value={matriksData.jenis}
                    onChange={(e) => setMatriksJenis(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                  >
                    {matriksData.daftarJenis.length > 0 ? (
                      matriksData.daftarJenis.map((j) => (
                        <option key={j} value={j}>
                          {j}
                        </option>
                      ))
                    ) : (
                      <option value="">Belum ada tarif rutin aktif</option>
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Legend */}
            {matriksKategori === 'Iuran Rutin' ? (
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="w-3.5 h-3.5 rounded-xs bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[9px]">
                    ✓
                  </span>
                  <span>Lunas</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3.5 h-3.5 rounded-xs bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[9px]">
                    ⏳
                  </span>
                  <span>Menunggu Verif</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3.5 h-3.5 rounded-xs bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-[9px]">
                    ✗
                  </span>
                  <span>Belum Bayar</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3.5 h-3.5 rounded-xs bg-slate-100 text-slate-400 font-bold flex items-center justify-center text-[9px]">
                    ·
                  </span>
                  <span>Akan Datang</span>
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Rekap partisipasi iuran insidental / Non Rutin per rumah tahun <b className="text-slate-800">{matriksTahun}</b>
              </div>
            )}
          </div>

          {matriksKategori === 'Iuran Rutin' ? (
            /* Big 12-Month Matrix Table */
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-center text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left sticky left-0 bg-slate-50 z-10 w-44">
                        Rumah & Kepala Keluarga
                      </th>
                      {MS.map((m) => (
                        <th key={m} className="px-2 py-3 min-w-[50px]">
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matriksData.rows.length > 0 ? (
                      matriksData.rows.map((r) => (
                        <tr key={r.alamat} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 text-left sticky left-0 bg-white z-10 whitespace-nowrap shadow-xs">
                            <button
                              type="button"
                              onClick={() => onOpenRiwayat(r.alamat)}
                              className="font-bold text-slate-900 hover:text-emerald-700 block text-left"
                              title="Klik untuk melihat riwayat lengkap"
                            >
                              Rumah {r.alamat}
                            </button>
                            <span className="text-[11px] text-slate-400 truncate block max-w-[140px]">
                              {r.kepala}
                            </span>
                          </td>
                          {Array.from({ length: 12 }, (_, i) => {
                            const mm = pad2(i + 1);
                            const stt = r.bulan[mm];

                            let badge = (
                              <span className="text-slate-300 font-light">·</span>
                            );
                            if (stt === 'lunas') {
                              badge = (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 font-bold text-xs">
                                  ✓
                                </span>
                              );
                            } else if (stt === 'menunggu') {
                              badge = (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 text-amber-800 font-bold text-xs" title="Menunggu verifikasi">
                                  ⏳
                                </span>
                              );
                            } else if (stt === 'belum') {
                              badge = (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-rose-100 text-rose-800 font-bold text-xs" title="Belum dibayar">
                                  ✗
                                </span>
                              );
                            } else if (stt === 'na') {
                              badge = <span className="text-slate-300">–</span>;
                            }

                            return (
                              <td key={mm} className="px-1 py-2">
                                {badge}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={13} className="px-4 py-10 text-center text-slate-400">
                          Belum ada data rumah atau tarif Iuran Rutin yang aktif. Atur besaran iuran di Pengaturan RT atau tab Tarif Iuran.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Rekap Iuran Non Rutin per Rumah */
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Rumah & Kepala Keluarga</th>
                      <th className="px-4 py-3">Jenis Iuran Terbayar</th>
                      <th className="px-4 py-3 text-center">Transaksi</th>
                      <th className="px-4 py-3 text-right">Total Terbayar</th>
                      <th className="px-4 py-3">Bayar Terakhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matriksData.nonRutinRows.length > 0 ? (
                      matriksData.nonRutinRows.map((r) => (
                        <tr key={r.alamat} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => onOpenRiwayat(r.alamat)}
                              className="font-bold text-slate-900 hover:text-emerald-700 block text-left"
                              title="Klik untuk melihat riwayat lengkap"
                            >
                              Rumah {r.alamat}
                            </button>
                            <span className="text-[11px] text-slate-400">{r.kepala}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-700">
                            {r.rincianJenis.length > 0 ? r.rincianJenis.join(', ') : <span className="text-slate-400">-</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="font-semibold text-slate-800">{r.jumlahTransaksi}x Lunas</span>
                            {r.menungguCount > 0 && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                                {r.menungguCount} menunggu
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-emerald-700">
                            {formatRupiah(r.totalNominal)}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                            {r.terakhirBayar ? formatTanggalIndo(r.terakhirBayar) : '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                          Belum ada data rumah terdaftar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 4: REKAP TUNGGAKAN
      ======================================================== */}
      {activeTab === 'tunggak' && (
        <div className="space-y-4">
          {/* Header Metric Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                Total Rumah Menunggak
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-800">
                {tunggakanData.totalRumah} <span className="text-xs font-normal text-slate-500">rumah</span>
              </div>
            </div>

            <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200/80">
              <span className="text-xs text-rose-800 font-semibold uppercase tracking-wider block mb-1">
                Total Nilai Tunggakan Keseluruhan
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-rose-700">
                {formatRupiah(tunggakanData.totalNominal)}
              </div>
            </div>
          </div>

          {/* Cards of Houses with Dues */}
          {tunggakanData.rows.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tunggakanData.rows.map((tg) => {
                const cleanHp = (tg.noHP || '').replace(/\D/g, '').replace(/^0/, '62');
                const waUrl = cleanHp ? `https://wa.me/${cleanHp}?text=${encodeURIComponent(tg.pesan)}` : '';

                return (
                  <div
                    key={tg.alamat}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="font-bold text-slate-900 text-base block">
                            Rumah {tg.alamat}
                          </span>
                          <span className="text-xs text-slate-500">{tg.kepala}</span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                          {tg.totalBulan} Bulan
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1 text-xs text-slate-700 my-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {tg.items.map((i) => (
                          <div key={i.jenis} className="flex justify-between items-start gap-2">
                            <span className="font-semibold text-slate-800 shrink-0">{i.jenis}:</span>
                            <span className="text-right text-slate-600 text-[11px] leading-tight">
                              {i.periode.map(periodeLabel).join(', ')}{' '}
                              <b className="font-mono tabular-nums text-slate-900">
                                ({formatRupiah(i.subtotal)})
                              </b>
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="text-right font-mono tabular-nums font-bold text-sm text-rose-700 mt-1 mb-3">
                        Total: {formatRupiah(tg.totalNominal)}
                      </div>
                    </div>

                    {/* Actions: Copy WA message, Send WA, View history */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleCopyWaText(tg.pesan)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                        title="Salin draf pengingat WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Salin Pesan WA</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                          >
                            <span>Buka WhatsApp</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No HP tidak ada</span>
                        )}

                        <button
                          type="button"
                          onClick={() => onOpenRiwayat(tg.alamat)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Riwayat
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 text-emerald-600">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              <p className="text-base font-bold text-slate-800">Alhamdulillah! Tidak Ada Tunggakan.</p>
              <p className="text-xs text-slate-500 mt-1">Seluruh rumah telah melunasi iuran sampai dengan bulan ini.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 5: TARIF IURAN
      ======================================================== */}
      {activeTab === 'tarif' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={tarifFilterKategori}
                onChange={(e) => setTarifFilterKategori(e.target.value as '' | KategoriIuranUtama)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="">Semua Kategori Iuran</option>
                <option value="Iuran Rutin">Iuran Rutin</option>
                <option value="Iuran Non Rutin">Iuran Non Rutin</option>
              </select>
              <p className="text-xs text-slate-500">
                Daftar tarif Iuran Rutin (bulanan) dan Iuran Non Rutin (insidental). Besaran default juga dapat diatur melalui Pengaturan RT.
              </p>
            </div>

            {perm.ubahKeuangan && (
              <button
                type="button"
                onClick={() => {
                  const st = dbService.getSettings();
                  const defaultNom = Number(st.NominalIuranRutin) || 20000;
                  setTarifModal({
                    JenisIuran: '',
                    TipeIuran: 'Iuran Rutin',
                    KategoriIuran: 'Umum',
                    Nominal: defaultNom,
                    Status: 'Aktif',
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Tarif</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Kategori Iuran</th>
                    <th className="px-4 py-3">Jenis Iuran</th>
                    <th className="px-4 py-3">Kelompok Hunian</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                    <th className="px-4 py-3">Status</th>
                    {perm.ubahKeuangan && <th className="px-4 py-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tarifData.length > 0 ? (
                    tarifData.map((t) => {
                      const isNonRutin = t.TipeIuran === 'Iuran Non Rutin';
                      return (
                        <tr key={t.ID} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                isNonRutin
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-sky-50 text-sky-800 border-sky-200'
                              }`}
                            >
                              {t.TipeIuran || 'Iuran Rutin'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{t.JenisIuran}</td>
                          <td className="px-4 py-3 text-slate-600">{t.KategoriIuran}</td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                            {formatRupiah(t.Nominal)}
                            <span className="text-[10px] font-sans font-normal text-slate-400 ml-1">
                              {isNonRutin ? '/ insidental' : '/ bulan'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                t.Status === 'Aktif'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {t.Status}
                            </span>
                          </td>
                          {perm.ubahKeuangan && (
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setTarifModal({ ...t })}
                                className="p-1 text-slate-500 hover:text-emerald-700 rounded transition-colors mr-1"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTarif(t.ID)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={perm.ubahKeuangan ? 6 : 5} className="px-4 py-10 text-center text-slate-400">
                        Belum ada tarif iuran yang diatur.
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
          MODALS
      ======================================================== */}
      {/* 1. KAS MODAL */}
      {kasModal && (
        <Modal
          isOpen={Boolean(kasModal)}
          onClose={() => setKasModal(null)}
          title={kasModal.ID ? 'Ubah Catatan Kas' : 'Catat Transaksi Buku Kas'}
          maxWidth="md"
        >
          <form onSubmit={handleSaveKasSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal *</label>
              <input
                type="date"
                required
                value={kasModal.Tanggal || ''}
                onChange={(e) => setKasModal({ ...kasModal, Tanggal: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Transaksi *</label>
                <select
                  value={kasModal.Jenis || 'Pengeluaran'}
                  onChange={(e) =>
                    setKasModal({
                      ...kasModal,
                      Jenis: e.target.value as 'Pemasukan' | 'Pengeluaran',
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Pemasukan">Pemasukan (+)</option>
                  <option value="Pengeluaran">Pengeluaran (-)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal (Rp) *</label>
                <input
                  type="number"
                  required
                  min={100}
                  value={kasModal.Nominal || ''}
                  onChange={(e) => setKasModal({ ...kasModal, Nominal: Number(e.target.value) })}
                  placeholder="50000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori *</label>
              <input
                type="text"
                required
                value={kasModal.Kategori || ''}
                onChange={(e) => setKasModal({ ...kasModal, Kategori: e.target.value })}
                placeholder="Contoh: Operasional Keamanan / Kerja Bakti / Listrik Pos"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Uraian Keterangan *</label>
              <textarea
                required
                rows={3}
                value={kasModal.Uraian || ''}
                onChange={(e) => setKasModal({ ...kasModal, Uraian: e.target.value })}
                placeholder="Uraian detail penggunaan dana atau sumber pemasukan..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setKasModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Simpan Transaksi
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 2. BUKTI MODAL */}
      {buktiModal && (
        <Modal
          isOpen={Boolean(buktiModal)}
          onClose={() => setBuktiModal(null)}
          title={`Bukti Transfer: ${buktiModal.kode} (Rumah ${buktiModal.alamat})`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-center">
            {buktiModal.url.startsWith('data:image/') || buktiModal.url.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
              <img
                src={buktiModal.url}
                alt="Bukti Transfer"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] mx-auto rounded-xl border border-slate-200 shadow-xs object-contain"
              />
            ) : (
              <div className="p-8 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
                <p className="text-sm font-semibold mb-2">Dokumen Bukti Transfer</p>
                <a
                  href={buktiModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl"
                >
                  <span>Buka Berkas</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 3. REJECT MODAL */}
      {rejectModal && (
        <Modal
          isOpen={Boolean(rejectModal)}
          onClose={() => setRejectModal(null)}
          title={`Tolak Pembayaran: ${rejectModal.kode}`}
          maxWidth="sm"
        >
          <form onSubmit={handleRejectPaymentSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Alasan Penolakan *
              </label>
              <textarea
                required
                rows={3}
                value={rejectModal.alasan}
                onChange={(e) => setRejectModal({ ...rejectModal, alasan: e.target.value })}
                placeholder="Contoh: Bukti transfer tidak jelas / nominal tidak sesuai / dana belum masuk rekening..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Tolak Pembayaran
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. TARIF MODAL */}
      {tarifModal && (
        <Modal
          isOpen={Boolean(tarifModal)}
          onClose={() => setTarifModal(null)}
          title={tarifModal.ID ? 'Ubah Tarif Iuran' : 'Tambah Tarif Iuran Baru'}
          maxWidth="sm"
        >
          <form onSubmit={handleSaveTarifSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori Iuran *</label>
              <select
                value={tarifModal.TipeIuran || 'Iuran Rutin'}
                onChange={(e) => {
                  const newTipe = e.target.value as KategoriIuranUtama;
                  const st = dbService.getSettings();
                  const preset =
                    newTipe === 'Iuran Non Rutin'
                      ? Number(st.NominalIuranNonRutin)
                      : Number(st.NominalIuranRutin);
                  setTarifModal({
                    ...tarifModal,
                    TipeIuran: newTipe,
                    Nominal: !tarifModal.ID && preset > 0 ? preset : tarifModal.Nominal,
                  });
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
              >
                <option value="Iuran Rutin">Iuran Rutin (Tagihan Bulanan)</option>
                <option value="Iuran Non Rutin">Iuran Non Rutin (Insidental / Kegiatan)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Iuran *</label>
              <input
                type="text"
                required
                value={tarifModal.JenisIuran || ''}
                onChange={(e) => setTarifModal({ ...tarifModal, JenisIuran: e.target.value })}
                placeholder={
                  tarifModal.TipeIuran === 'Iuran Non Rutin'
                    ? 'Contoh: Iuran 17 Agustus / Perbaikan Jalan / Dana Sosial'
                    : 'Contoh: Iuran Rutin / Keamanan / Kebersihan'
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kelompok Hunian *</label>
              <input
                type="text"
                required
                value={tarifModal.KategoriIuran || 'Umum'}
                onChange={(e) => setTarifModal({ ...tarifModal, KategoriIuran: e.target.value })}
                placeholder="Umum"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {tarifModal.TipeIuran === 'Iuran Non Rutin' ? 'Nominal Standar (Rp) *' : 'Nominal per Bulan (Rp) *'}
              </label>
              <input
                type="number"
                required
                min={1000}
                value={tarifModal.Nominal || ''}
                onChange={(e) => setTarifModal({ ...tarifModal, Nominal: Number(e.target.value) })}
                placeholder="30000"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status Tarif *</label>
              <select
                value={tarifModal.Status || 'Aktif'}
                onChange={(e) =>
                  setTarifModal({
                    ...tarifModal,
                    Status: e.target.value as 'Aktif' | 'Nonaktif',
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTarifModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Simpan Tarif
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
