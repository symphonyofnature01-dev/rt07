import React, { useState } from 'react';
import { dbService, formatTanggalIndo } from '../services/spreadsheetDb';
import {
  HubunganKeluarga,
  JenisKelamin,
  PendudukRow,
  PeranKeluarga,
  PihakPembayar,
  RumahDetailView,
  RumahRow,
  StatusHunian,
  StatusMenghuni,
  StatusPenduduk,
  UserSession,
} from '../types/database';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import {
  Home,
  Plus,
  Search,
  Users,
  Download,
  KeyRound,
  Edit2,
  Trash2,
  UserPlus,
  Phone,
  FileSpreadsheet,
  Building,
  Calendar,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface RumahWargaViewProps {
  session: UserSession;
  onOpenRiwayat: (alamat: string) => void;
}

export const RumahWargaView: React.FC<RumahWargaViewProps> = ({
  session,
  onOpenRiwayat,
}) => {
  const { toast } = useToast();
  const perm = session.perm;

  // Search & Filters
  const [query, setQuery] = useState('');
  const [filterBlok, setFilterBlok] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals state
  const [detailModal, setDetailModal] = useState<RumahDetailView | null>(null);
  const [detailTab, setDetailTab] = useState<'warga' | 'riwayat' | 'iuran'>('warga');

  // Rumah Modal (Add / Edit)
  const [rumahModal, setRumahModal] = useState<{
    ID?: string;
    Blok: string;
    Nomor: string;
    Alamat: string;
    StatusHunian: StatusHunian;
    PihakPembayarIuran: PihakPembayar;
    KategoriIuran: string;
    Catatan: string;
  } | null>(null);

  // Warga Modal (Add / Edit Penduduk + Relasi Keluarga)
  const [wargaModal, setWargaModal] = useState<{
    rumahId: string;
    rumahAlamat: string;
    isFollowUpFromNewHouse?: boolean;
    pendudukId?: string;
    keluargaId?: string;
    // Data Penduduk
    NIK: string;
    NamaLengkap: string;
    JenisKelamin: JenisKelamin;
    TempatLahir: string;
    TanggalLahir: string;
    NoHP: string;
    Pekerjaan: string;
    StatusPenduduk: StatusPenduduk;
    // Data Keluarga Link
    HubunganKeluarga: HubunganKeluarga;
    Peran: PeranKeluarga;
    StatusMenghuni: StatusMenghuni;
  } | null>(null);

  // Riwayat Hunian Modal
  const [riwayatModal, setRiwayatModal] = useState<{
    IDRumah: string;
    rumahAlamat: string;
    NamaKeluarga: string;
    JenisHunian: 'Pemilik' | 'Sewa';
    TanggalMulai: string;
    TanggalSelesai: string;
    StatusHunian: 'Aktif' | 'Selesai';
    Catatan: string;
  } | null>(null);

  // PIN Modal
  const [pinModal, setPinModal] = useState<{ rumah: RumahRow; pin: string } | null>(null);

  const rumahList = dbService.listRumah();
  const allBlok = Array.from(new Set(rumahList.map((r) => r.Blok).filter(Boolean))).sort();
  const tarifList = dbService.listTarif();
  const kategoriOptions = Array.from(new Set(['Umum', ...tarifList.map((t) => t.KategoriIuran)]));

  // Filtered list
  const filteredRumah = rumahList.filter((r) => {
    if (filterBlok && r.Blok !== filterBlok) return false;
    if (filterStatus && r.StatusHunian !== filterStatus) return false;
    if (query) {
      const q = query.toLowerCase();
      const match =
        r.Alamat.toLowerCase().includes(q) ||
        (r.NamaPemilik || '').toLowerCase().includes(q) ||
        (r.NamaPenghuni || '').toLowerCase().includes(q) ||
        (r.NamaKepalaKeluarga || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // CSV Exports
  const handleExportRumahCsv = () => {
    const csv = dbService.exportSheetCsv('Rumah');
    downloadCsvFile('data-rumah-rt07.csv', csv);
    toast('Data rumah berhasil diekspor ke CSV.', 'success');
  };

  const handleExportPendudukCsv = () => {
    const csv = dbService.exportSheetCsv('Penduduk');
    downloadCsvFile('data-penduduk-rt07.csv', csv);
    toast('Data penduduk berhasil diekspor ke CSV.', 'success');
  };

  const handleExportKeluargaCsv = () => {
    const csv = dbService.exportSheetCsv('Keluarga');
    downloadCsvFile('data-hubungan-keluarga-rt07.csv', csv);
    toast('Data hubungan keluarga berhasil diekspor ke CSV.', 'success');
  };

  const downloadCsvFile = (filename: string, content: string) => {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Open Add Rumah
  const handleOpenAddRumah = () => {
    setRumahModal({
      Blok: 'A4',
      Nomor: '',
      Alamat: '',
      StatusHunian: 'Dihuni Pemilik',
      PihakPembayarIuran: 'Pemilik',
      KategoriIuran: 'Umum',
      Catatan: '',
    });
  };

  // Open Edit Rumah
  const handleOpenEditRumah = (r: RumahRow) => {
    setRumahModal({
      ID: r.ID,
      Blok: r.Blok,
      Nomor: r.Nomor,
      Alamat: r.Alamat,
      StatusHunian: r.StatusHunian,
      PihakPembayarIuran: r.PihakPembayarIuran,
      KategoriIuran: r.KategoriIuran || 'Umum',
      Catatan: r.Catatan || '',
    });
  };

  // Submit Rumah: CRITICAL UX REQUIREMENT!
  // "untuk pengurus, Ketika tambah rumah dan setelah mengisi semua form dan berhasil simpan, ada form untuk data warga"
  const handleSaveRumahSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rumahModal) return;

    try {
      const res = dbService.saveRumah(rumahModal, session.nama);
      const isNew = res.isNew;
      const rumahId = res.ID;
      const alamat = res.alamat;

      setRumahModal(null);

      if (isNew) {
        toast(`Rumah ${alamat} berhasil ditambahkan! Silakan lengkapi data keluarga / warganya.`, 'success');

        // Determine smart default Peran based on StatusHunian
        const defaultPeran: PeranKeluarga = rumahModal.StatusHunian === 'Dikontrakkan' ? 'Pemilik' : 'Pemilik';
        const defaultMenghuni: StatusMenghuni = rumahModal.StatusHunian === 'Dihuni Pemilik' ? 'Menghuni' : 'Tidak Menghuni';

        // Immediately open the Resident form for this new house!
        setWargaModal({
          rumahId,
          rumahAlamat: alamat,
          isFollowUpFromNewHouse: true,
          NIK: '',
          NamaLengkap: '',
          JenisKelamin: 'Laki-laki',
          TempatLahir: '',
          TanggalLahir: '',
          NoHP: '',
          Pekerjaan: '',
          StatusPenduduk: 'Tetap',
          HubunganKeluarga: 'Kepala Keluarga',
          Peran: defaultPeran,
          StatusMenghuni: defaultMenghuni,
        });
      } else {
        toast(`Data rumah ${alamat} berhasil diperbarui.`, 'success');
        if (detailModal && detailModal.rumah.ID === rumahId) {
          setDetailModal(dbService.getRumahDetail(rumahId));
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  // Delete Rumah
  const handleDeleteRumah = (r: RumahRow) => {
    if (!window.confirm(`Yakin ingin menghapus rumah ${r.Alamat} beserta seluruh hubungannya?`)) return;
    try {
      dbService.deleteRumah(r.ID, session.nama);
      toast(`Rumah ${r.Alamat} berhasil dihapus.`, 'success');
      if (detailModal?.rumah.ID === r.ID) setDetailModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  // Open Detail Modal
  const handleOpenDetail = (id: string) => {
    try {
      const detail = dbService.getRumahDetail(id);
      setDetailModal(detail);
      setDetailTab('warga');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  const refreshDetail = (id: string) => {
    setDetailModal(dbService.getRumahDetail(id));
  };

  // Open Add Warga
  const handleOpenAddWarga = (rumahId: string, alamat: string, defaultPeran?: PeranKeluarga) => {
    const peran = defaultPeran || 'Anggota Keluarga Pemilik';
    const statusMenghuni: StatusMenghuni = peran.includes('Penyewa') ? 'Menghuni' : peran === 'Pemilik' ? 'Menghuni' : 'Menghuni';

    setWargaModal({
      rumahId,
      rumahAlamat: alamat,
      isFollowUpFromNewHouse: false,
      NIK: '',
      NamaLengkap: '',
      JenisKelamin: 'Laki-laki',
      TempatLahir: '',
      TanggalLahir: '',
      NoHP: '',
      Pekerjaan: '',
      StatusPenduduk: peran.includes('Penyewa') ? 'Sementara' : 'Tetap',
      HubunganKeluarga: 'Anak',
      Peran: peran,
      StatusMenghuni: statusMenghuni,
    });
  };

  // Open Edit Warga
  const handleOpenEditWarga = (rumahId: string, alamat: string, anggota: { keluarga: any; penduduk: PendudukRow }) => {
    setWargaModal({
      rumahId,
      rumahAlamat: alamat,
      isFollowUpFromNewHouse: false,
      pendudukId: anggota.penduduk.ID,
      keluargaId: anggota.keluarga.ID,
      NIK: anggota.penduduk.NIK,
      NamaLengkap: anggota.penduduk.NamaLengkap,
      JenisKelamin: anggota.penduduk.JenisKelamin,
      TempatLahir: anggota.penduduk.TempatLahir || '',
      TanggalLahir: anggota.penduduk.TanggalLahir || '',
      NoHP: anggota.penduduk.NoHP || '',
      Pekerjaan: anggota.penduduk.Pekerjaan || '',
      StatusPenduduk: anggota.penduduk.StatusPenduduk,
      HubunganKeluarga: anggota.keluarga.HubunganKeluarga,
      Peran: anggota.keluarga.Peran,
      StatusMenghuni: anggota.keluarga.StatusMenghuni,
    });
  };

  // Submit Warga
  const handleSaveWargaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wargaModal) return;

    try {
      dbService.savePendudukDanKeluarga(
        wargaModal.rumahId,
        {
          ID: wargaModal.pendudukId,
          NIK: wargaModal.NIK,
          NamaLengkap: wargaModal.NamaLengkap,
          JenisKelamin: wargaModal.JenisKelamin,
          TempatLahir: wargaModal.TempatLahir,
          TanggalLahir: wargaModal.TanggalLahir,
          NoHP: wargaModal.NoHP,
          Pekerjaan: wargaModal.Pekerjaan,
          StatusPenduduk: wargaModal.StatusPenduduk,
        },
        {
          ID: wargaModal.keluargaId,
          HubunganKeluarga: wargaModal.HubunganKeluarga,
          Peran: wargaModal.Peran,
          StatusMenghuni: wargaModal.StatusMenghuni,
        },
        session.nama
      );

      toast(`${wargaModal.NamaLengkap} berhasil disimpan ke ${wargaModal.rumahAlamat}!`, 'success');

      const savedRumahId = wargaModal.rumahId;
      const savedAlamat = wargaModal.rumahAlamat;
      const wasFollowUp = wargaModal.isFollowUpFromNewHouse;

      setWargaModal(null);

      if (detailModal && detailModal.rumah.ID === savedRumahId) {
        refreshDetail(savedRumahId);
      }

      // If this was follow-up from adding a new house, ask if they want to add another member
      if (wasFollowUp) {
        if (window.confirm(`Berhasil menambahkan ${wargaModal.NamaLengkap}. Apakah ingin menambahkan anggota keluarga lainnya untuk ${savedAlamat}?`)) {
          handleOpenAddWarga(savedRumahId, savedAlamat, 'Anggota Keluarga Pemilik');
        } else {
          handleOpenDetail(savedRumahId);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  // Delete Warga from House
  const handleDeleteWarga = (rumahId: string, pendudukId: string, nama: string) => {
    if (!window.confirm(`Hapus ${nama} dari daftar keluarga rumah ini?`)) return;
    try {
      dbService.deletePendudukDariRumah(rumahId, pendudukId, session.nama);
      toast(`${nama} berhasil dihapus dari rumah.`, 'success');
      refreshDetail(rumahId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  // Add Riwayat Hunian
  const handleSaveRiwayatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!riwayatModal) return;

    try {
      dbService.addRiwayatHunian(
        {
          IDRumah: riwayatModal.IDRumah,
          NamaKeluarga: riwayatModal.NamaKeluarga,
          JenisHunian: riwayatModal.JenisHunian,
          TanggalMulai: riwayatModal.TanggalMulai,
          TanggalSelesai: riwayatModal.TanggalSelesai,
          StatusHunian: riwayatModal.StatusHunian,
          Catatan: riwayatModal.Catatan,
        },
        session.nama
      );

      toast('Riwayat hunian/kontrak berhasil ditambahkan.', 'success');
      const rId = riwayatModal.IDRumah;
      setRiwayatModal(null);
      if (detailModal && detailModal.rumah.ID === rId) {
        refreshDetail(rId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  // Update Penanggung Jawab Iuran
  const handleUpdatePenanggungJawab = (rumahId: string, idPenduduk: string, pihak: PihakPembayar) => {
    try {
      dbService.setPenanggungJawabIuran(rumahId, idPenduduk, pihak, session.nama);
      toast(`Penanggung jawab iuran diubah menjadi ${pihak}.`, 'success');
      refreshDetail(rumahId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  // PIN handler
  const handleSavePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModal) return;
    try {
      dbService.setPinRumah(pinModal.rumah.ID, pinModal.pin, session.nama);
      toast(pinModal.pin ? 'PIN rumah berhasil disimpan.' : 'PIN rumah dihapus.', 'success');
      setPinModal(null);
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
            Data Warga & Rumah
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {perm.ubahData && (
            <button
              type="button"
              onClick={handleOpenAddRumah}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Rumah</span>
            </button>
          )}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExportRumahCsv}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              title="Ekspor CSV Rumah"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV Rumah</span>
            </button>

            <button
              type="button"
              onClick={handleExportPendudukCsv}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              title="Ekspor CSV Data Penduduk"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV Penduduk</span>
            </button>

            <button
              type="button"
              onClick={handleExportKeluargaCsv}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              title="Ekspor CSV Hubungan Keluarga"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV Keluarga</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari alamat, nama pemilik, penghuni, atau KK..."
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterBlok}
            onChange={(e) => setFilterBlok(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all flex-1 sm:flex-none cursor-pointer"
          >
            <option value="">Semua Blok</option>
            {allBlok.map((b) => (
              <option key={b} value={b}>
                Blok {b}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all flex-1 sm:flex-none cursor-pointer"
          >
            <option value="">Semua Status Hunian</option>
            <option value="Dihuni Pemilik">Dihuni Pemilik</option>
            <option value="Dikontrakkan">Dikontrakkan</option>
            <option value="Kosong">Kosong (Tidak Ditinggali)</option>
          </select>
        </div>
      </div>

      {/* Grid of House Cards */}
      {filteredRumah.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRumah.map((r) => {
            const detail = dbService.getRumahDetail(r.ID);

            const statusBadgeStyle =
              r.StatusHunian === 'Dihuni Pemilik'
                ? 'bg-emerald-100/80 text-emerald-800 border-emerald-200'
                : r.StatusHunian === 'Dikontrakkan'
                ? 'bg-blue-100/80 text-blue-800 border-blue-200'
                : 'bg-amber-100/80 text-amber-800 border-amber-200';

            return (
              <div
                key={r.ID}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-sm shrink-0">
                        {r.Blok}/{r.Nomor}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 text-base leading-tight block">
                          {r.Alamat}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Tarif: {r.KategoriIuran} · Bayar: <b>{r.PihakPembayarIuran}</b>
                        </span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${statusBadgeStyle}`}>
                      {r.StatusHunian}
                    </span>
                  </div>

                  {/* Relational Profile Summary Box */}
                  <div className="mt-3 space-y-1.5 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    {/* Pemilik Rumah */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Pemilik Rumah:</span>
                      <span className="font-semibold text-slate-800">
                        {detail.pemilik?.NamaLengkap || '-'}
                      </span>
                    </div>

                    {/* Penghuni / Penyewa Aktif */}
                    {r.StatusHunian === 'Dikontrakkan' && (
                      <div className="flex items-center justify-between">
                        <span className="text-blue-600 font-medium">Penyewa (Aktif):</span>
                        <span className="font-semibold text-blue-950">
                          {detail.keluargaPenyewa[0]?.penduduk.NamaLengkap || '-'}
                        </span>
                      </div>
                    )}

                    {r.StatusHunian === 'Kosong' && (
                      <div className="flex items-center justify-between text-amber-800">
                        <span className="text-amber-600 font-medium">Penghuni:</span>
                        <span className="italic font-medium">Rumah Sedang Kosong</span>
                      </div>
                    )}

                    {/* Jumlah Jiwa Tinggal vs Total */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                      <span className="text-slate-400">Jiwa Tinggal:</span>
                      <span className="font-semibold font-mono tabular-nums text-slate-800">
                        {detail.jumlahJiwaTinggal} jiwa menghuni ({detail.jumlahJiwaTotal} terdata)
                      </span>
                    </div>

                    {/* Kontak Aktif */}
                    {detail.kontakPenghuniAktif && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Kontak WhatsApp:</span>
                        <span className="font-mono text-slate-700 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{detail.kontakPenghuniAktif}</span>
                        </span>
                      </div>
                    )}

                    {/* Penanggung Jawab Iuran */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 text-[11px]">
                      <span className="text-slate-400">Iuran Dibayar Oleh:</span>
                      <span className="font-semibold text-emerald-800">
                        {r.PihakPembayarIuran} ({detail.penanggungJawab?.NamaLengkap || detail.pemilik?.NamaLengkap || '-'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(r.ID)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Keluarga ({detail.jumlahJiwaTotal})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenRiwayat(r.Alamat)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Iuran
                    </button>
                  </div>

                  {perm.ubahData && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPinModal({ rumah: r, pin: '' })}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          r.PINHash
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600'
                        }`}
                        title={r.PINHash ? 'PIN aktif (Klik untuk ganti)' : 'Atur PIN Warga'}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditRumah(r)}
                        className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                        title="Ubah Data Rumah"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteRumah(r)}
                        className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                        title="Hapus Rumah"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 text-slate-400">
          <Home className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium">Tidak ada rumah yang sesuai dengan pencarian atau filter.</p>
        </div>
      )}

      {/* ========================================================
          DETAILED HOUSE MODAL (Handles Scenarios 1, 2, and 3)
      ======================================================== */}
      {detailModal && (
        <Modal
          isOpen={Boolean(detailModal)}
          onClose={() => setDetailModal(null)}
          title={`Detail Rumah ${detailModal.rumah.Alamat}`}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500 font-medium">
                {detailModal.jumlahJiwaTinggal} jiwa menghuni · {detailModal.semuaAnggota.length} orang terdaftar
              </span>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Tutup
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Header info badge */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Status Hunian</span>
                <span className="font-bold text-slate-900 text-sm">{detailModal.rumah.StatusHunian}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Pemilik Rumah</span>
                <span className="font-semibold text-slate-800">{detailModal.pemilik?.NamaLengkap || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Iuran Dibayar Oleh</span>
                <span className="font-bold text-emerald-800">
                  {detailModal.rumah.PihakPembayarIuran} ({detailModal.penanggungJawab?.NamaLengkap || '-'})
                </span>
              </div>

              {perm.ubahData && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenAddWarga(detailModal.rumah.ID, detailModal.rumah.Alamat, 'Anggota Keluarga Pemilik')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Warga / Keluarga</span>
                  </button>
                </div>
              )}
            </div>

            {/* Sub-tabs inside Detail Modal */}
            <div className="flex border-b border-slate-200 text-xs font-semibold gap-4">
              <button
                type="button"
                onClick={() => setDetailTab('warga')}
                className={`pb-2 border-b-2 transition-all cursor-pointer ${
                  detailTab === 'warga'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Keluarga & Penghuni ({detailModal.semuaAnggota.length})
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('riwayat')}
                className={`pb-2 border-b-2 transition-all cursor-pointer ${
                  detailTab === 'riwayat'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Riwayat Kontrak / Hunian ({detailModal.riwayatHunian.length})
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('iuran')}
                className={`pb-2 border-b-2 transition-all cursor-pointer ${
                  detailTab === 'iuran'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Penanggung Jawab Iuran
              </button>
            </div>

            {/* TAB CONTENT: WARGA & KELUARGA */}
            {detailTab === 'warga' && (
              <div className="space-y-4">
                {/* 1. KELUARGA PEMILIK */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      <span>Keluarga Pemilik Rumah ({detailModal.keluargaPemilik.length} orang)</span>
                    </span>
                    {perm.ubahData && (
                      <button
                        type="button"
                        onClick={() => handleOpenAddWarga(detailModal.rumah.ID, detailModal.rumah.Alamat, 'Anggota Keluarga Pemilik')}
                        className="text-xs text-emerald-700 hover:underline font-semibold"
                      >
                        + Tambah Keluarga Pemilik
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2">Nama Lengkap</th>
                          <th className="px-3 py-2">Hubungan</th>
                          <th className="px-3 py-2">NIK</th>
                          <th className="px-3 py-2">Status Menghuni</th>
                          {perm.ubahData && <th className="px-3 py-2 text-right">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailModal.keluargaPemilik.map((m) => (
                          <tr key={m.penduduk.ID} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2.5 font-medium text-slate-900">
                              {m.penduduk.NamaLengkap}
                              <div className="text-[10px] text-slate-400">
                                {m.penduduk.JenisKelamin} · {m.penduduk.StatusPenduduk}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-slate-800">{m.keluarga.HubunganKeluarga}</td>
                            <td className="px-3 py-2.5 font-mono tabular-nums text-slate-600">{m.penduduk.NIK}</td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                  m.keluarga.StatusMenghuni === 'Menghuni'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {m.keluarga.StatusMenghuni}
                              </span>
                            </td>
                            {perm.ubahData && (
                              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditWarga(detailModal.rumah.ID, detailModal.rumah.Alamat, m)}
                                  className="p-1 text-slate-500 hover:text-emerald-700 rounded transition-colors mr-1"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteWarga(detailModal.rumah.ID, m.penduduk.ID, m.penduduk.NamaLengkap)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {detailModal.keluargaPemilik.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                              Belum ada data keluarga pemilik.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. KELUARGA PENYEWA (Jika Dikontrakkan atau ada riwayat sewa) */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      <span>Penyewa / Penghuni Sementara ({detailModal.keluargaPenyewa.length} orang)</span>
                    </span>
                    {perm.ubahData && (
                      <button
                        type="button"
                        onClick={() => handleOpenAddWarga(detailModal.rumah.ID, detailModal.rumah.Alamat, 'Penyewa')}
                        className="text-xs text-blue-700 hover:underline font-semibold"
                      >
                        + Tambah Penyewa
                      </button>
                    )}
                  </div>

                  {detailModal.rumah.StatusHunian === 'Dikontrakkan' && detailModal.keluargaPenyewa.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2">Nama Penyewa</th>
                            <th className="px-3 py-2">Hubungan</th>
                            <th className="px-3 py-2">NIK</th>
                            <th className="px-3 py-2">No. WhatsApp</th>
                            <th className="px-3 py-2">Status Menghuni</th>
                            {perm.ubahData && <th className="px-3 py-2 text-right">Aksi</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detailModal.keluargaPenyewa.map((m) => (
                            <tr key={m.penduduk.ID} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2.5 font-medium text-slate-900">
                                {m.penduduk.NamaLengkap}
                                <div className="text-[10px] text-slate-400">
                                  {m.penduduk.JenisKelamin} · {m.penduduk.StatusPenduduk}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 font-medium text-slate-800">{m.keluarga.HubunganKeluarga}</td>
                              <td className="px-3 py-2.5 font-mono tabular-nums text-slate-600">{m.penduduk.NIK}</td>
                              <td className="px-3 py-2.5 font-mono text-slate-700">{m.penduduk.NoHP || '-'}</td>
                              <td className="px-3 py-2.5">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                  {m.keluarga.StatusMenghuni}
                                </span>
                              </td>
                              {perm.ubahData && (
                                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditWarga(detailModal.rumah.ID, detailModal.rumah.Alamat, m)}
                                    className="p-1 text-slate-500 hover:text-emerald-700 rounded transition-colors mr-1"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteWarga(detailModal.rumah.ID, m.penduduk.ID, m.penduduk.NamaLengkap)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl">
                      {detailModal.rumah.StatusHunian === 'Kosong'
                        ? 'Rumah saat ini kosong dan tidak ada penyewa.'
                        : 'Rumah dihuni sendiri oleh pemilik. Belum/tidak ada data penyewa.'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: RIWAYAT KONTRAK & HUNIAN */}
            {detailTab === 'riwayat' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Rekam jejak pergantian penghuni dan riwayat kontrak rumah tanpa menghapus data warga lama.
                  </p>
                  {perm.ubahData && (
                    <button
                      type="button"
                      onClick={() =>
                        setRiwayatModal({
                          IDRumah: detailModal.rumah.ID,
                          rumahAlamat: detailModal.rumah.Alamat,
                          NamaKeluarga: '',
                          JenisHunian: 'Sewa',
                          TanggalMulai: new Date().toISOString().slice(0, 10),
                          TanggalSelesai: '',
                          StatusHunian: 'Aktif',
                          Catatan: '',
                        })
                      }
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Catat Kontrak / Sewa Baru</span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">Keluarga / Penghuni</th>
                        <th className="px-3 py-2.5">Jenis</th>
                        <th className="px-3 py-2.5">Mulai</th>
                        <th className="px-3 py-2.5">Selesai</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailModal.riwayatHunian.map((rwt) => (
                        <tr key={rwt.ID} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-bold text-slate-900">{rwt.NamaKeluarga}</td>
                          <td className="px-3 py-2.5">{rwt.JenisHunian}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-600">{rwt.TanggalMulai}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-600">{rwt.TanggalSelesai || 'Sekarang'}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                rwt.StatusHunian === 'Aktif'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {rwt.StatusHunian}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{rwt.Catatan || '-'}</td>
                        </tr>
                      ))}
                      {detailModal.riwayatHunian.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                            Belum ada riwayat hunian dicatat.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: PENGATURAN PENANGGUNG JAWAB IURAN */}
            {detailTab === 'iuran' && (
              <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">
                    Pengaturan Penanggung Jawab Pembayaran Iuran
                  </h4>
                  <p className="text-slate-500 leading-relaxed">
                    Sistem memungkinkan pencatatan siapa yang bertanggung jawab membayar iuran bulanan
                    (apakah Pemilik Rumah atau Penyewa) tanpa mengubah status kepemilikan sah rumah.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-slate-700">Pihak Penanggung Jawab:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdatePenanggungJawab(
                            detailModal.rumah.ID,
                            detailModal.pemilik?.ID || '',
                            'Pemilik'
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                          detailModal.rumah.PihakPembayarIuran === 'Pemilik'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Pemilik Rumah ({detailModal.pemilik?.NamaLengkap || '-'})
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const penyewaId = detailModal.keluargaPenyewa[0]?.penduduk.ID || '';
                          handleUpdatePenanggungJawab(detailModal.rumah.ID, penyewaId, 'Penyewa');
                        }}
                        className={`px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                          detailModal.rumah.PihakPembayarIuran === 'Penyewa'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Penyewa ({detailModal.keluargaPenyewa[0]?.penduduk.NamaLengkap || 'Penyewa Aktif'})
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Penanggung Jawab Terpilih:</span>
                      <span className="font-bold text-slate-900">
                        {detailModal.rumah.PihakPembayarIuran} (
                        {detailModal.penanggungJawab?.NamaLengkap || detailModal.pemilik?.NamaLengkap || '-'}
                        )
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">No. WhatsApp Pengingat:</span>
                      <span className="font-mono text-slate-800">
                        {detailModal.penanggungJawab?.NoHP || detailModal.pemilik?.NoHP || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ========================================================
          ADD / EDIT RUMAH MODAL
      ======================================================== */}
      {rumahModal && (
        <Modal
          isOpen={Boolean(rumahModal)}
          onClose={() => setRumahModal(null)}
          title={rumahModal.ID ? `Ubah Data Rumah ${rumahModal.Alamat}` : 'Tambah Rumah Baru'}
          maxWidth="md"
        >
          <form onSubmit={handleSaveRumahSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Blok *</label>
                <input
                  type="text"
                  required
                  value={rumahModal.Blok}
                  onChange={(e) => {
                    const b = e.target.value.toUpperCase();
                    setRumahModal({
                      ...rumahModal,
                      Blok: b,
                      Alamat: `Blok ${b}/${rumahModal.Nomor}`,
                    });
                  }}
                  placeholder="Contoh: A4"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nomor Rumah *</label>
                <input
                  type="text"
                  required
                  value={rumahModal.Nomor}
                  onChange={(e) => {
                    const n = e.target.value;
                    setRumahModal({
                      ...rumahModal,
                      Nomor: n,
                      Alamat: `Blok ${rumahModal.Blok}/${n}`,
                    });
                  }}
                  placeholder="Contoh: 1"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat Lengkap *</label>
              <input
                type="text"
                required
                value={rumahModal.Alamat}
                onChange={(e) => setRumahModal({ ...rumahModal, Alamat: e.target.value })}
                placeholder="Blok A4/1"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status Hunian *</label>
                <select
                  value={rumahModal.StatusHunian}
                  onChange={(e) => {
                    const st = e.target.value as StatusHunian;
                    setRumahModal({
                      ...rumahModal,
                      StatusHunian: st,
                      PihakPembayarIuran: st === 'Dikontrakkan' ? 'Penyewa' : 'Pemilik',
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="Dihuni Pemilik">Dihuni Pemilik</option>
                  <option value="Dikontrakkan">Dikontrakkan</option>
                  <option value="Kosong">Kosong</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Pihak Pembayar Iuran *</label>
                <select
                  value={rumahModal.PihakPembayarIuran}
                  onChange={(e) =>
                    setRumahModal({
                      ...rumahModal,
                      PihakPembayarIuran: e.target.value as PihakPembayar,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="Pemilik">Pemilik Rumah</option>
                  <option value="Penyewa">Penyewa (Penghuni Sementara)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori Tarif Iuran *</label>
              <select
                value={rumahModal.KategoriIuran}
                onChange={(e) => setRumahModal({ ...rumahModal, KategoriIuran: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {kategoriOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Catatan</label>
              <textarea
                rows={2}
                value={rumahModal.Catatan}
                onChange={(e) => setRumahModal({ ...rumahModal, Catatan: e.target.value })}
                placeholder="Catatan kepemilikan, nomor listrik, status..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Setelah menyimpan form rumah ini, sistem akan <b>langsung membuka form data warga</b> untuk mengisi pemilik atau penghuninya.
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRumahModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Simpan & Lanjut Isi Warga
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================
          ADD / EDIT WARGA MODAL (Penduduk + Keluarga Relational)
      ======================================================== */}
      {wargaModal && (
        <Modal
          isOpen={Boolean(wargaModal)}
          onClose={() => setWargaModal(null)}
          title={`Isi Data Warga untuk ${wargaModal.rumahAlamat}`}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveWargaSubmit} className="space-y-3.5">
            {wargaModal.isFollowUpFromNewHouse && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <b>Langkah 2:</b> Masukkan data warga / kepala keluarga untuk rumah <b>{wargaModal.rumahAlamat}</b>.
                </span>
              </div>
            )}

            {/* Peran & Hubungan */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Peran di Rumah *</label>
                <select
                  value={wargaModal.Peran}
                  onChange={(e) => {
                    const p = e.target.value as PeranKeluarga;
                    setWargaModal({
                      ...wargaModal,
                      Peran: p,
                      StatusMenghuni: p.includes('Penyewa') ? 'Menghuni' : wargaModal.StatusMenghuni,
                      StatusPenduduk: p.includes('Penyewa') ? 'Sementara' : 'Tetap',
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="Pemilik">Pemilik Rumah</option>
                  <option value="Anggota Keluarga Pemilik">Keluarga Pemilik</option>
                  <option value="Penyewa">Penyewa / Kontrak</option>
                  <option value="Anggota Keluarga Penyewa">Keluarga Penyewa</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Hubungan Keluarga *</label>
                <select
                  value={wargaModal.HubunganKeluarga}
                  onChange={(e) =>
                    setWargaModal({
                      ...wargaModal,
                      HubunganKeluarga: e.target.value as HubunganKeluarga,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="Kepala Keluarga">Kepala Keluarga</option>
                  <option value="Istri">Istri</option>
                  <option value="Suami">Suami</option>
                  <option value="Anak">Anak</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status Menghuni *</label>
                <select
                  value={wargaModal.StatusMenghuni}
                  onChange={(e) =>
                    setWargaModal({
                      ...wargaModal,
                      StatusMenghuni: e.target.value as StatusMenghuni,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="Menghuni">Menghuni (Tinggal Aktif)</option>
                  <option value="Tidak Menghuni">Tidak Menghuni</option>
                </select>
              </div>
            </div>

            {/* Nama & NIK */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={wargaModal.NamaLengkap}
                  onChange={(e) => setWargaModal({ ...wargaModal, NamaLengkap: e.target.value })}
                  placeholder="Masukkan nama lengkap"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">NIK (16 Digit Angka) *</label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  value={wargaModal.NIK}
                  onChange={(e) => setWargaModal({ ...wargaModal, NIK: e.target.value.replace(/\D/g, '') })}
                  placeholder="3275xxxxxxxxxxxx"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Jenis Kelamin & Status Penduduk */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Kelamin *</label>
                <select
                  value={wargaModal.JenisKelamin}
                  onChange={(e) =>
                    setWargaModal({
                      ...wargaModal,
                      JenisKelamin: e.target.value as JenisKelamin,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">No. WhatsApp / HP</label>
                <input
                  type="text"
                  value={wargaModal.NoHP}
                  onChange={(e) => setWargaModal({ ...wargaModal, NoHP: e.target.value })}
                  placeholder="0812xxxxxxxx"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status Kependudukan *</label>
                <select
                  value={wargaModal.StatusPenduduk}
                  onChange={(e) =>
                    setWargaModal({
                      ...wargaModal,
                      StatusPenduduk: e.target.value as StatusPenduduk,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Tetap">Penduduk Tetap</option>
                  <option value="Sementara">Penduduk Sementara (Kontrak)</option>
                </select>
              </div>
            </div>

            {/* Tempat & Tanggal Lahir */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tempat Lahir</label>
                <input
                  type="text"
                  value={wargaModal.TempatLahir}
                  onChange={(e) => setWargaModal({ ...wargaModal, TempatLahir: e.target.value })}
                  placeholder="Kota kelahiran"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Lahir</label>
                <input
                  type="date"
                  value={wargaModal.TanggalLahir}
                  onChange={(e) => setWargaModal({ ...wargaModal, TanggalLahir: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Pekerjaan</label>
              <input
                type="text"
                value={wargaModal.Pekerjaan}
                onChange={(e) => setWargaModal({ ...wargaModal, Pekerjaan: e.target.value })}
                placeholder="Karyawan Swasta / Pelajar / Wiraswasta"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setWargaModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Simpan Data Warga
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================
          RIWAYAT HUNIAN MODAL
      ======================================================== */}
      {riwayatModal && (
        <Modal
          isOpen={Boolean(riwayatModal)}
          onClose={() => setRiwayatModal(null)}
          title={`Catat Riwayat Kontrak / Hunian - ${riwayatModal.rumahAlamat}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveRiwayatSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nama Keluarga / Penyewa *
              </label>
              <input
                type="text"
                required
                value={riwayatModal.NamaKeluarga}
                onChange={(e) => setRiwayatModal({ ...riwayatModal, NamaKeluarga: e.target.value })}
                placeholder="Masukkan nama kepala keluarga / penyewa"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Hunian *</label>
                <select
                  value={riwayatModal.JenisHunian}
                  onChange={(e) =>
                    setRiwayatModal({
                      ...riwayatModal,
                      JenisHunian: e.target.value as 'Pemilik' | 'Sewa',
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Sewa">Sewa / Kontrak</option>
                  <option value="Pemilik">Dihuni Pemilik</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status Kontrak *</label>
                <select
                  value={riwayatModal.StatusHunian}
                  onChange={(e) =>
                    setRiwayatModal({
                      ...riwayatModal,
                      StatusHunian: e.target.value as 'Aktif' | 'Selesai',
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="Aktif">Aktif (Sedang Berjalan)</option>
                  <option value="Selesai">Selesai (Sudah Pindah)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Mulai *</label>
                <input
                  type="date"
                  required
                  value={riwayatModal.TanggalMulai}
                  onChange={(e) => setRiwayatModal({ ...riwayatModal, TanggalMulai: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Selesai</label>
                <input
                  type="date"
                  value={riwayatModal.TanggalSelesai}
                  onChange={(e) => setRiwayatModal({ ...riwayatModal, TanggalSelesai: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Catatan Sewa</label>
              <textarea
                rows={2}
                value={riwayatModal.Catatan}
                onChange={(e) => setRiwayatModal({ ...riwayatModal, Catatan: e.target.value })}
                placeholder="Durasi sewa 1 tahun, penanggung jawab iuran penyewa..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRiwayatModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Simpan Riwayat
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================
          PIN MODAL
      ======================================================== */}
      {pinModal && (
        <Modal
          isOpen={Boolean(pinModal)}
          onClose={() => setPinModal(null)}
          title={`Kelola PIN Warga: Rumah ${pinModal.rumah.Alamat}`}
          maxWidth="sm"
        >
          <form onSubmit={handleSavePinSubmit} className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              PIN digunakan warga rumah {pinModal.rumah.Alamat} saat login jika fitur PIN diaktifkan di Pengaturan.
              Kosongkan jika ingin menghapus PIN.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                PIN Baru (4 - 6 Digit Angka)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinModal.pin}
                onChange={(e) => setPinModal({ ...pinModal, pin: e.target.value.replace(/\D/g, '') })}
                placeholder="Contoh: 1234"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono tracking-widest text-center"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPinModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Simpan PIN
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
