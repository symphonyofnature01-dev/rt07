import React from 'react';
import { dbService, formatRupiah, formatTanggalIndo } from '../services/spreadsheetDb';
import { UserSession } from '../types/database';
import { Wallet, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react';

interface KeuanganPublikViewProps {
  session: UserSession;
}

export const KeuanganPublikView: React.FC<KeuanganPublikViewProps> = () => {
  const summary = dbService.getKasSummary();
  const rawKas = dbService.listKas().rows;
  const tarifList = dbService.listTarif().filter((t) => t.Status === 'Aktif');

  // SVG Chart calculation
  const series = summary.series || [];
  const maxVal = Math.max(1, ...series.flatMap((s) => [s.masuk, s.keluar]));
  const chartHeight = 120;
  const chartWidth = 320;
  const barWidth = 14;
  const gap = (chartWidth - series.length * barWidth * 2) / (series.length + 1);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Transparansi Keuangan RT 07
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Laporan pembukuan kas terbuka untuk seluruh warga lingkungan RT
        </p>
      </div>

      {/* Top 3 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Saldo Kas RT</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatRupiah(summary.saldo)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Saldo kas saat ini</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Pemasukan</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600">
            {formatRupiah(summary.totalMasuk)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Akumulasi iuran & kas masuk</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Pengeluaran</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-rose-600">
            {formatRupiah(summary.totalKeluar)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Operasional & kegiatan warga</span>
        </div>
      </div>

      {/* Chart and Active Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 6-Month Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Grafik Arus Kas 6 Bulan</h3>
              <p className="text-xs text-slate-500">Pemasukan dan pengeluaran berkala</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600"></span>
                <span>Masuk</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500"></span>
                <span>Keluar</span>
              </span>
            </div>
          </div>

          <div className="w-full flex justify-center py-2">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 24}`} className="w-full max-w-md overflow-visible">
              {series.map((s, idx) => {
                const x0 = gap + idx * (barWidth * 2 + gap);
                const hIn = (s.masuk / maxVal) * chartHeight;
                const hOut = (s.keluar / maxVal) * chartHeight;
                return (
                  <g key={s.periode}>
                    <rect
                      x={x0}
                      y={0}
                      width={barWidth * 2}
                      height={chartHeight}
                      rx={3}
                      fill="#f1f5f9"
                      opacity={0.6}
                    />
                    <rect
                      x={x0}
                      y={chartHeight - hIn}
                      width={barWidth - 1}
                      height={Math.max(2, hIn)}
                      rx={3}
                      className="fill-emerald-600"
                    />
                    <rect
                      x={x0 + barWidth}
                      y={chartHeight - hOut}
                      width={barWidth - 1}
                      height={Math.max(2, hOut)}
                      rx={3}
                      className="fill-amber-500"
                    />
                    <text
                      x={x0 + barWidth}
                      y={chartHeight + 16}
                      textAnchor="middle"
                      fontSize="10"
                      className="fill-slate-500 font-medium"
                    >
                      {s.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Tarif Iuran Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Ketentuan Tarif Iuran</h3>
                <p className="text-xs text-slate-500">Besaran Iuran Rutin & Non Rutin yang berlaku di RT 07</p>
              </div>
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>

            <div className="divide-y divide-slate-100 space-y-2">
              {tarifList.length > 0 ? (
                tarifList.map((t) => {
                  const isNonRutin = t.TipeIuran === 'Iuran Non Rutin';
                  return (
                    <div key={t.ID} className="pt-2 flex items-center justify-between text-xs sm:text-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{t.JenisIuran}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                              isNonRutin
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-sky-50 text-sky-800 border-sky-200'
                            }`}
                          >
                            {t.TipeIuran || 'Iuran Rutin'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block">Kelompok: {t.KategoriIuran}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono tabular-nums font-bold text-slate-900">
                          {formatRupiah(t.Nominal)}
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          {isNonRutin ? '/ insidental' : '/ bulan'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Ketentuan tarif iuran belum diatur oleh pengurus.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-500 border border-slate-100">
            Iuran digunakan untuk kebutuhan operasional rutin lingkungan RT serta kegiatan insidental warga secara transparan.
          </div>
        </div>
      </div>

      {/* Recent Cash Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Catatan Pembukuan Kas Terkini</h3>
            <p className="text-xs text-slate-500">Transparansi keluar-masuk dana lingkungan</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Uraian Transaksi</th>
                <th className="px-4 py-3 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rawKas.slice(0, 30).map((k) => {
                const isMasuk = k.Jenis === 'Pemasukan';
                return (
                  <tr key={k.ID} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap text-slate-600">
                      {formatTanggalIndo(k.Tanggal)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                          isMasuk ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {k.Jenis}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{k.Kategori}</td>
                    <td className="px-4 py-2.5 text-slate-700 max-w-md truncate">
                      {k.SumberReferensi ? `Iuran Warga (${k.Kategori.replace('Iuran ', '')})` : k.Uraian}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        isMasuk ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isMasuk ? '+' : '-'} {formatRupiah(k.Nominal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
