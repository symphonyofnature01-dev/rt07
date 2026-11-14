import React, { useState } from 'react';
import { dbService, formatTanggalIndo, BULAN, pad2, todayStr } from '../services/spreadsheetDb';
import { AgendaRow, StatusAgenda, UserSession } from '../types/database';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import {
  CalendarDays,
  Plus,
  Search,
  MapPin,
  Clock,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  List,
  Calendar,
} from 'lucide-react';

interface AgendaViewProps {
  session: UserSession;
}

export const AgendaView: React.FC<AgendaViewProps> = ({ session }) => {
  const { toast } = useToast();
  const perm = session.perm;

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Calendar view state
  const [calDate, setCalDate] = useState(() => new Date());

  // Modal state
  const [agendaModal, setAgendaModal] = useState<Partial<AgendaRow> | null>(null);

  const agendaList = dbService.listAgenda({
    status: filterStatus || undefined,
    q: searchQuery,
  });

  const handleSaveAgendaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agendaModal) return;
    try {
      dbService.saveAgenda(agendaModal, session.nama);
      toast(agendaModal.ID ? 'Agenda berhasil diperbarui.' : 'Agenda baru ditambahkan.', 'success');
      setAgendaModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  const handleDeleteAgenda = (id: string, judul: string) => {
    if (!window.confirm(`Hapus agenda "${judul}"?`)) return;
    try {
      dbService.deleteAgenda(id, session.nama);
      toast('Agenda berhasil dihapus.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  // Calendar rendering helper
  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const currentPrefix = `${calYear}-${pad2(calMonth + 1)}`;

  const eventsByDay: Record<number, AgendaRow[]> = {};
  agendaList.forEach((a) => {
    if (a.Tanggal.startsWith(currentPrefix)) {
      const d = Number(a.Tanggal.slice(8, 10));
      if (!eventsByDay[d]) eventsByDay[d] = [];
      eventsByDay[d].push(a);
    }
  });

  const prevMonth = () => setCalDate(new Date(calYear, calMonth - 1, 1));
  const nextMonth = () => setCalDate(new Date(calYear, calMonth + 1, 1));

  const today = todayStr();

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Agenda Kegiatan RT 07
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Jadwal kegiatan warga, kerja bakti, rapat pleno, dan perayaan lingkungan
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
              title="Tampilan Daftar"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
              title="Tampilan Kalender"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>

          {perm.ubahData && (
            <button
              type="button"
              onClick={() =>
                setAgendaModal({
                  Tanggal: todayStr(),
                  Waktu: '08:00',
                  Status: 'Akan Datang',
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Agenda</span>
            </button>
          )}
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul, lokasi, atau deskripsi kegiatan..."
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 w-full sm:w-auto"
        >
          <option value="">Semua Status Kegiatan</option>
          <option value="Akan Datang">Akan Datang</option>
          <option value="Selesai">Selesai</option>
          <option value="Dibatalkan">Dibatalkan</option>
        </select>
      </div>

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {agendaList.map((a) => {
            const statusColor =
              a.StatusTampil === 'Akan Datang'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : a.StatusTampil === 'Selesai'
                ? 'bg-slate-100 text-slate-600 border-slate-200'
                : 'bg-rose-50 text-rose-700 border-rose-200';

            return (
              <div
                key={a.ID}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-start justify-between gap-4 hover:border-slate-300 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-100 flex flex-col items-center justify-center shrink-0 font-bold leading-none">
                    <span className="text-base font-extrabold">{a.Tanggal.slice(8)}</span>
                    <span className="text-[10px] font-semibold uppercase mt-0.5">
                      {BULAN[Number(a.Tanggal.slice(5, 7)) - 1]?.slice(0, 3)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">{a.Judul}</h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${statusColor}`}>
                        {a.StatusTampil}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-medium">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatTanggalIndo(a.Tanggal)}</span>
                      </span>

                      {a.Waktu && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{a.Waktu} WIB</span>
                        </span>
                      )}

                      {a.Lokasi && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{a.Lokasi}</span>
                        </span>
                      )}
                    </div>

                    {a.Deskripsi && (
                      <p className="text-xs text-slate-600 pt-1 leading-relaxed whitespace-pre-line max-w-2xl">
                        {a.Deskripsi}
                      </p>
                    )}
                  </div>
                </div>

                {perm.ubahData && (
                  <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => setAgendaModal({ ...a })}
                      className="p-1.5 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Ubah Agenda"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAgenda(a.ID, a.Judul)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Hapus Agenda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {agendaList.length === 0 && (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 text-slate-400">
              <CalendarDays className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">Tidak ada agenda kegiatan pada filter ini.</p>
            </div>
          )}
        </div>
      )}

      {/* CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          {/* Month Controller */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-base">
              {BULAN[calMonth]} {calYear}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
              <div key={d} className="text-center text-xs font-bold text-slate-400 py-1.5">
                {d}
              </div>
            ))}

            {/* Empty offset days */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[70px] sm:min-h-[85px] bg-slate-50/40 rounded-xl" />
            ))}

            {/* Month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateKey = `${currentPrefix}-${pad2(day)}`;
              const isToday = dateKey === today;
              const dayEvents = eventsByDay[day] || [];

              return (
                <div
                  key={day}
                  className={`min-h-[70px] sm:min-h-[85px] p-1.5 rounded-xl border flex flex-col justify-between transition-all ${
                    isToday
                      ? 'border-emerald-500 bg-emerald-50/40'
                      : 'border-slate-200/60 bg-white hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday ? 'text-emerald-700 font-extrabold' : 'text-slate-700'
                      }`}
                    >
                      {day}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.ID}
                        onClick={() => perm.ubahData && setAgendaModal({ ...ev })}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-600 text-white font-medium truncate cursor-pointer"
                        title={`${ev.Waktu ? ev.Waktu + ' - ' : ''}${ev.Judul}`}
                      >
                        {ev.Judul}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-slate-400 font-medium block">
                        +{dayEvents.length - 2} lainnya
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AGENDA MODAL */}
      {agendaModal && (
        <Modal
          isOpen={Boolean(agendaModal)}
          onClose={() => setAgendaModal(null)}
          title={agendaModal.ID ? 'Ubah Agenda Kegiatan' : 'Tambah Agenda Kegiatan Baru'}
          maxWidth="md"
        >
          <form onSubmit={handleSaveAgendaSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Judul Agenda *</label>
              <input
                type="text"
                required
                value={agendaModal.Judul || ''}
                onChange={(e) => setAgendaModal({ ...agendaModal, Judul: e.target.value })}
                placeholder="Contoh: Kerja Bakti Lingkungan / Senam Bersama"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Kegiatan *</label>
                <input
                  type="date"
                  required
                  value={agendaModal.Tanggal || ''}
                  onChange={(e) => setAgendaModal({ ...agendaModal, Tanggal: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Waktu (Pukul WIB)</label>
                <input
                  type="time"
                  value={agendaModal.Waktu || ''}
                  onChange={(e) => setAgendaModal({ ...agendaModal, Waktu: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lokasi Kegiatan</label>
                <input
                  type="text"
                  value={agendaModal.Lokasi || ''}
                  onChange={(e) => setAgendaModal({ ...agendaModal, Lokasi: e.target.value })}
                  placeholder="Contoh: Lapangan RT 07 / Balai Warga"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status Kegiatan *</label>
                <select
                  value={agendaModal.Status || 'Akan Datang'}
                  onChange={(e) =>
                    setAgendaModal({
                      ...agendaModal,
                      Status: e.target.value as StatusAgenda,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Akan Datang">Akan Datang</option>
                  <option value="Selesai">Selesai</option>
                  <option value="Dibatalkan">Dibatalkan</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi Kegiatan</label>
              <textarea
                rows={3}
                value={agendaModal.Deskripsi || ''}
                onChange={(e) => setAgendaModal({ ...agendaModal, Deskripsi: e.target.value })}
                placeholder="Rincian informasi acara, perlengkapan yang perlu dibawa..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAgendaModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Simpan Agenda
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
