import React, { useState } from 'react';
import { dbService, formatTanggalIndo, todayStr } from '../services/spreadsheetDb';
import { InfoRow, UserSession } from '../types/database';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import {
  Megaphone,
  Plus,
  Search,
  Calendar,
  User,
  Edit2,
  Trash2,
} from 'lucide-react';

interface InformasiViewProps {
  session: UserSession;
}

export const InformasiView: React.FC<InformasiViewProps> = ({ session }) => {
  const { toast } = useToast();
  const isWarga = session.type === 'warga';
  const perm = session.perm;

  const [filterKategori, setFilterKategori] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [infoModal, setInfoModal] = useState<Partial<InfoRow> | null>(null);

  const infoList = dbService.listInfo(
    {
      kategori: filterKategori || undefined,
      status: filterStatus || undefined,
      q: searchQuery,
    },
    isWarga
  );

  const handleSaveInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!infoModal) return;
    try {
      dbService.saveInfo(infoModal, session.nama);
      toast(infoModal.ID ? 'Informasi diperbarui.' : 'Informasi baru berhasil diterbitkan.', 'success');
      setInfoModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  const handleDeleteInfo = (id: string, judul: string) => {
    if (!window.confirm(`Hapus informasi "${judul}"?`)) return;
    try {
      dbService.deleteInfo(id, session.nama);
      toast('Informasi berhasil dihapus.', 'success');
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
            Pusat Informasi & Pengumuman
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Warta resmi pengurus RT 07 untuk seluruh warga
          </p>
        </div>

        {perm.ubahData && (
          <button
            type="button"
            onClick={() =>
              setInfoModal({
                Kategori: 'Pengumuman',
                TanggalTerbit: todayStr(),
                Status: 'Publish',
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ Buat Pengumuman</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kata kunci pada judul atau isi informasi..."
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 flex-1 sm:flex-none cursor-pointer"
          >
            <option value="">Semua Kategori</option>
            <option value="Pengumuman">Pengumuman</option>
            <option value="Keuangan">Keuangan</option>
            <option value="Keamanan">Keamanan</option>
            <option value="Lainnya">Lainnya</option>
          </select>

          {!isWarga && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 flex-1 sm:flex-none cursor-pointer"
            >
              <option value="">Semua Status</option>
              <option value="Publish">Publish</option>
              <option value="Draft">Draft</option>
            </select>
          )}
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {infoList.map((inf) => {
          const kategoriColor =
            inf.Kategori === 'Keamanan'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : inf.Kategori === 'Keuangan'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200';

          return (
            <div
              key={inf.ID}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${kategoriColor}`}>
                      {inf.Kategori}
                    </span>
                    {inf.Status === 'Draft' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                        Draft (Belum Tampil di Warga)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-medium text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatTanggalIndo(inf.TanggalTerbit)}</span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      <span>{inf.DibuatOleh}</span>
                    </span>
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">
                  {inf.Judul}
                </h3>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {inf.Isi}
                </p>
              </div>

              {perm.ubahData && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setInfoModal({ ...inf })}
                    className="p-1.5 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Ubah Pengumuman"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteInfo(inf.ID, inf.Judul)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Hapus Pengumuman"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {infoList.length === 0 && (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 text-slate-400">
            <Megaphone className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">Belum ada pengumuman yang sesuai dengan pencarian Anda.</p>
          </div>
        )}
      </div>

      {/* INFO MODAL */}
      {infoModal && (
        <Modal
          isOpen={Boolean(infoModal)}
          onClose={() => setInfoModal(null)}
          title={infoModal.ID ? 'Ubah Pengumuman Warga' : 'Buat Pengumuman Baru'}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveInfoSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Judul Pengumuman *</label>
              <input
                type="text"
                required
                value={infoModal.Judul || ''}
                onChange={(e) => setInfoModal({ ...infoModal, Judul: e.target.value })}
                placeholder="Contoh: Jadwal Ronda Malam & Pengambilan Sampah..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori *</label>
                <select
                  value={infoModal.Kategori || 'Pengumuman'}
                  onChange={(e) =>
                    setInfoModal({
                      ...infoModal,
                      Kategori: e.target.value as 'Pengumuman' | 'Keuangan' | 'Keamanan' | 'Lainnya',
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Pengumuman">Pengumuman</option>
                  <option value="Keuangan">Keuangan</option>
                  <option value="Keamanan">Keamanan</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Terbit *</label>
                <input
                  type="date"
                  required
                  value={infoModal.TanggalTerbit || todayStr()}
                  onChange={(e) => setInfoModal({ ...infoModal, TanggalTerbit: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status Publikasi *</label>
                <select
                  value={infoModal.Status || 'Publish'}
                  onChange={(e) =>
                    setInfoModal({
                      ...infoModal,
                      Status: e.target.value as 'Publish' | 'Draft',
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="Publish">Publish (Tampil ke Warga)</option>
                  <option value="Draft">Draft (Hanya Pengurus)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Isi Pengumuman / Pesan *</label>
              <textarea
                required
                rows={6}
                value={infoModal.Isi || ''}
                onChange={(e) => setInfoModal({ ...infoModal, Isi: e.target.value })}
                placeholder="Tuliskan isi pengumuman lengkap untuk warga..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 leading-relaxed"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Terbitkan Pengumuman
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
