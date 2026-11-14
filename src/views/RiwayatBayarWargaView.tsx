import React, { useState } from 'react';
import { dbService, formatRupiah, formatTanggalIndo, MS, pad2, periodeLabel } from '../services/spreadsheetDb';
import { KategoriIuranUtama, UserSession } from '../types/database';
import { Modal } from '../components/Modal';
import {
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Eye,
  ExternalLink,
  Plus,
} from 'lucide-react';

interface RiwayatBayarWargaViewProps {
  session: UserSession;
  alamatOverride?: string;
  onOpenBayarModal: (alamat: string) => void;
}

export const RiwayatBayarWargaView: React.FC<RiwayatBayarWargaViewProps> = ({
  session,
  alamatOverride,
  onOpenBayarModal,
}) => {
  const isWarga = session.type === 'warga';
  const rumahList = dbService.listRumah();
  const targetAlamat = alamatOverride || (isWarga ? session.alamat || '' : rumahList[0]?.Alamat || '');

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [filterKategori, setFilterKategori] = useState<'' | KategoriIuranUtama>('');
  const [buktiModal, setBuktiModal] = useState<{ kode: string; url: string } | null>(null);

  if (!targetAlamat) {
    return (
      <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 text-slate-400">
        <CreditCard className="w-10 h-10 mx-auto text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-600">Belum ada data rumah yang dipilih atau terdaftar.</p>
      </div>
    );
  }

  const riwayatData = dbService.getRiwayatIuran(targetAlamat, selectedYear);
  const filteredTransaksi = filterKategori
    ? riwayatData.transaksi.filter((t) => t.tipeIuran === filterKategori)
    : riwayatData.transaksi;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Riwayat Iuran Rumah {riwayatData.alamat}
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
              {riwayatData.statusHunian}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Catatan pembayaran dan status kelunasan iuran bulanan
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Year selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs sm:text-sm font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
            >
              {[currentYear - 3, currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => onOpenBayarModal(riwayatData.alamat)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Bayar Iuran</span>
          </button>
        </div>
      </div>

      {/* Tunggakan Alert Banner */}
      {riwayatData.tunggakan.length > 0 ? (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-900">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs sm:text-sm">
              <span className="font-bold block">
                Total Tunggakan Iuran: {formatRupiah(riwayatData.totalTunggakan)}
              </span>
              <div className="text-xs text-amber-800 space-y-0.5">
                {riwayatData.tunggakan.map((t) => (
                  <div key={t.jenis}>
                    <span className="font-semibold">{t.jenis}:</span> {t.periode.map(periodeLabel).join(', ')}{' '}
                    <span className="font-mono font-medium">({formatRupiah(t.subtotal)})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 flex items-center gap-2.5 text-xs sm:text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">
            Iuran rumah ini tercatat lunas sampai dengan bulan berjalan.
          </span>
        </div>
      )}

      {/* 12-Month Matrix per Routine Fee Type */}
      <div className="space-y-4">
        {riwayatData.jenis.length > 0 ? (
          riwayatData.jenis.map((j) => (
            <div key={j} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-sm">
                    {j} · Tahun {riwayatData.tahun}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                    Iuran Rutin
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
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
                    <span>Menunggu</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3.5 h-3.5 rounded-xs bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-[9px]">
                      ✗
                    </span>
                    <span>Belum</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
                {MS.map((mName, i) => {
                  const mm = pad2(i + 1);
                  const stt = riwayatData.grid[j]?.[mm];

                  let bgClass = 'bg-slate-50 text-slate-400 border-slate-200';
                  let icon = '·';
                  let label = 'Akan';

                  if (stt === 'lunas') {
                    bgClass = 'bg-emerald-100/80 text-emerald-800 border-emerald-300 font-bold';
                    icon = '✓';
                    label = 'Lunas';
                  } else if (stt === 'menunggu') {
                    bgClass = 'bg-amber-100/80 text-amber-800 border-amber-300 font-bold';
                    icon = '⏳';
                    label = 'Menunggu';
                  } else if (stt === 'belum') {
                    bgClass = 'bg-rose-100/80 text-rose-800 border-rose-300 font-bold';
                    icon = '✗';
                    label = 'Belum';
                  } else if (stt === 'na') {
                    bgClass = 'bg-slate-50 text-slate-300 border-slate-100';
                    icon = '–';
                    label = 'N/A';
                  }

                  return (
                    <div
                      key={mm}
                      className={`p-2 rounded-xl border text-center transition-all ${bgClass}`}
                    >
                      <span className="text-[11px] block font-semibold">{mName}</span>
                      <span className="text-sm block font-mono my-0.5">{icon}</span>
                      <span className="text-[10px] block opacity-80">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 text-center text-xs text-slate-500">
            Belum ada tarif Iuran Rutin yang aktif untuk matriks 12 bulan.
          </div>
        )}
      </div>

      {/* Rekap Iuran Non Rutin */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm">Rekap Iuran Non Rutin (Insidental)</h3>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              Iuran Non Rutin
            </span>
          </div>
          <div className="text-xs text-slate-600">
            Total Terverifikasi:{' '}
            <span className="font-mono font-bold text-emerald-700">
              {formatRupiah(riwayatData.nonRutinTotal)}
            </span>
          </div>
        </div>

        {riwayatData.nonRutinTransaksi.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {riwayatData.nonRutinTransaksi.map((nr) => (
              <div
                key={nr.kode}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-start justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{nr.jenis}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {formatTanggalIndo(nr.tanggalBayar)} · {nr.metode}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-slate-900">{formatRupiah(nr.total)}</div>
                  <span
                    className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      nr.status === 'Terverifikasi'
                        ? 'bg-emerald-100 text-emerald-800'
                        : nr.status === 'Menunggu Verifikasi'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {nr.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Belum ada catatan pembayaran Iuran Non Rutin untuk rumah ini.
          </p>
        )}
      </div>

      {/* Transaction History for this House */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Riwayat Transaksi Rumah {riwayatData.alamat}</h3>
            <p className="text-xs text-slate-500">Semua transaksi pembayaran Iuran Rutin & Non Rutin yang pernah dicatat</p>
          </div>
          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value as '' | KategoriIuranUtama)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="">Semua Kategori Iuran</option>
            <option value="Iuran Rutin">Iuran Rutin</option>
            <option value="Iuran Non Rutin">Iuran Non Rutin</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Tanggal Bayar</th>
                <th className="px-4 py-3">Kategori & Jenis</th>
                <th className="px-4 py-3">Periode / Keterangan</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransaksi.map((t) => (
                <tr key={t.kode} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                    {formatTanggalIndo(t.tanggalBayar)}
                    <div className="text-[10px] text-slate-400 font-mono">{t.kode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{t.jenis}</div>
                    <span
                      className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        t.tipeIuran === 'Iuran Non Rutin'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-sky-50 text-sky-800 border-sky-200'
                      }`}
                    >
                      {t.tipeIuran}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                    {t.tipeIuran === 'Iuran Non Rutin'
                      ? `Insidental (${formatTanggalIndo(t.tanggalBayar)})`
                      : t.periode.map(periodeLabel).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900">
                    {formatRupiah(t.total)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        t.status === 'Terverifikasi'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : t.status === 'Menunggu Verifikasi'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.adaBukti && t.buktiURL ? (
                      <button
                        type="button"
                        onClick={() => setBuktiModal({ kode: t.kode, url: t.buktiURL! })}
                        className="p-1.5 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Lihat Bukti"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredTransaksi.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Belum ada riwayat transaksi pembayaran iuran untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BUKTI MODAL */}
      {buktiModal && (
        <Modal
          isOpen={Boolean(buktiModal)}
          onClose={() => setBuktiModal(null)}
          title={`Bukti Pembayaran: ${buktiModal.kode}`}
          maxWidth="md"
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
                <p className="text-sm font-semibold mb-2">Dokumen Berkas Bukti</p>
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
    </div>
  );
};
