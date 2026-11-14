import React from 'react';
import { dbService, formatRupiah, formatTanggalIndo, periodeLabel } from '../services/spreadsheetDb';
import { UserSession } from '../types/database';
import { PageId } from '../components/Navigation';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Home,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Upload,
} from 'lucide-react';

interface DashboardViewProps {
  session: UserSession;
  onNavigate: (page: PageId, tab?: string) => void;
  onOpenBayar?: (alamat?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  session,
  onNavigate,
  onOpenBayar,
}) => {
  const data = dbService.getDashboardData(session);
  const isWarga = session.type === 'warga';

  // SVG Chart calculation
  const series = data.series || [];
  const maxVal = Math.max(1, ...series.flatMap((s) => [s.masuk, s.keluar]));
  const chartHeight = 120;
  const chartWidth = 320;
  const barWidth = 14;
  const gap = (chartWidth - series.length * barWidth * 2) / (series.length + 1);

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Beranda {data.namaRT}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Selamat datang di sistem informasi dan pembukuan iuran digital lingkungan RT
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {isWarga ? (
            <button
              type="button"
              onClick={() => onOpenBayar && onOpenBayar(session.alamat)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Bayar / Unggah Iuran</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('kas', 'verif')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Verifikasi Pembayaran</span>
            </button>
          )}
        </div>
      </div>

      {/* WARGA VIEW: Iuran Status Card */}
      {isWarga && data.iuran && (
        <div
          className={`p-5 rounded-2xl border ${
            data.iuran.lunas
              ? 'bg-emerald-50/70 border-emerald-200/80'
              : 'bg-amber-50/80 border-amber-200/90'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold text-slate-900">
                  Status Iuran Rumah {data.rumah?.alamat}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/80 border border-slate-200/60 text-slate-700">
                  {data.rumah?.statusHunian}
                </span>
              </div>

              {data.iuran.lunas ? (
                <div className="flex items-center gap-2 text-emerald-800 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Iuran Anda lunas sampai bulan ini. Terima kasih atas partisipasi aktif Anda!</span>
                </div>
              ) : (
                <div className="space-y-2 text-amber-900 text-sm">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Terdapat tunggakan {data.iuran.totalBulan} bulan dengan total{' '}
                      <span className="font-mono tabular-nums font-bold">
                        {formatRupiah(data.iuran.totalNominal)}
                      </span>
                    </span>
                  </div>
                  <div className="text-xs text-amber-800 space-y-1 pl-6">
                    {data.iuran.tunggakan.map((t) => (
                      <div key={t.jenis}>
                        <span className="font-semibold">{t.jenis}:</span>{' '}
                        <span>{t.periode.map(periodeLabel).join(', ')}</span>{' '}
                        <span className="font-mono font-medium">({formatRupiah(t.subtotal)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.iuran.menunggu > 0 && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5 pt-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>{data.iuran.menunggu} transaksi sedang menunggu verifikasi pengurus.</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenBayar && onOpenBayar(session.alamat)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Bayar Iuran
              </button>
              <button
                type="button"
                onClick={() => onNavigate('iuran')}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 transition-colors cursor-pointer"
              >
                Riwayat Saya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* METRIC STATS: For Pengurus */}
      {!isWarga && data.ringkas && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Saldo Kas */}
            <div
              onClick={() => onNavigate('kas', 'buku')}
              className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Saldo Kas RT</span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900">
                {formatRupiah(data.saldo)}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Total saldo aktif di pembukuan</span>
            </div>

            {/* Pemasukan Bulan Ini */}
            <div
              onClick={() => onNavigate('kas', 'buku')}
              className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pemasukan Bulan Ini</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-600">
                {formatRupiah(data.bulanIni?.masuk || 0)}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Bulan berjalan</span>
            </div>

            {/* Pengeluaran Bulan Ini */}
            <div
              onClick={() => onNavigate('kas', 'buku')}
              className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pengeluaran Bulan Ini</span>
                <TrendingDown className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-rose-600">
                {formatRupiah(data.bulanIni?.keluar || 0)}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Operasional & kegiatan</span>
            </div>

            {/* Menunggu Verifikasi */}
            <div
              onClick={() => onNavigate('kas', 'verif')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                data.ringkas.menungguVerifikasi > 0
                  ? 'bg-amber-50/80 border-amber-200 hover:border-amber-400'
                  : 'bg-white border-slate-200/80 shadow-xs hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Verifikasi Iuran</span>
                <Clock className={`w-4 h-4 ${data.ringkas.menungguVerifikasi > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900">
                {data.ringkas.menungguVerifikasi} <span className="text-xs font-normal text-slate-500">transaksi</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {data.ringkas.menungguVerifikasi > 0 ? 'Perlu tindakan pengurus' : 'Semua transaksi terverifikasi'}
              </span>
            </div>
          </div>

          {/* Secondary stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Rumah */}
            <div
              onClick={() => onNavigate('warga')}
              className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                <span>Total Rumah Terdata</span>
                <Home className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-800">
                {data.ringkas.totalRumah} <span className="text-xs font-normal text-slate-500">unit</span>
              </div>
            </div>

            {/* Total Warga */}
            <div
              onClick={() => onNavigate('warga')}
              className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                <span>Warga ({data.ringkas.wargaTinggal} tinggal)</span>
                <Users className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-800">
                {data.ringkas.totalWarga} <span className="text-xs font-normal text-slate-500">jiwa</span>
              </div>
            </div>

            {/* Rumah Menunggak */}
            <div
              onClick={() => onNavigate('kas', 'tunggak')}
              className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                <span>Rumah Menunggak</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-amber-700">
                {data.ringkas.rumahMenunggak} <span className="text-xs font-normal text-slate-500">rumah</span>
              </div>
            </div>

            {/* Total Tunggakan */}
            <div
              onClick={() => onNavigate('kas', 'tunggak')}
              className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                <span>Total Tunggakan Iuran</span>
                <CoinsIcon className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-rose-700">
                {formatRupiah(data.ringkas.totalTunggakan)}
              </div>
            </div>
          </div>

          {/* Status Hunian Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 text-xs flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold text-slate-700">Distribusi Status Hunian Warga:</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Dihuni Pemilik:</span>
                <b className="font-mono tabular-nums">{data.ringkas.perStatus['Dihuni Pemilik']}</b>
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>Dikontrakkan:</span>
                <b className="font-mono tabular-nums">{data.ringkas.perStatus['Dikontrakkan']}</b>
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Kosong:</span>
                <b className="font-mono tabular-nums">{data.ringkas.perStatus.Kosong}</b>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* WARGA VIEW: 3-column financial overview */}
      {isWarga && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Saldo Kas RT
            </span>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900">
              {formatRupiah(data.saldo)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Kas transparan untuk seluruh warga</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Pemasukan Bulan Ini
            </span>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-600">
              {formatRupiah(data.bulanIni?.masuk || 0)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Iuran & donasi warga</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Pengeluaran Bulan Ini
            </span>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-rose-600">
              {formatRupiah(data.bulanIni?.keluar || 0)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Biaya keamanan, sampah & operasional</span>
          </div>
        </div>
      )}

      {/* Grid: 6-Month Chart + Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                Pemasukan vs Pengeluaran (6 Bulan)
              </h3>
              <p className="text-xs text-slate-500">Tren arus kas kas RT</p>
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

          {/* SVG Bar Chart */}
          <div className="w-full flex justify-center py-2">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 24}`} className="w-full max-w-md overflow-visible">
              {series.map((s, idx) => {
                const x0 = gap + idx * (barWidth * 2 + gap);
                const hIn = (s.masuk / maxVal) * chartHeight;
                const hOut = (s.keluar / maxVal) * chartHeight;
                return (
                  <g key={s.periode}>
                    {/* Background track */}
                    <rect
                      x={x0}
                      y={0}
                      width={barWidth * 2}
                      height={chartHeight}
                      rx={3}
                      fill="#f1f5f9"
                      opacity={0.6}
                    />
                    {/* Bar In */}
                    <rect
                      x={x0}
                      y={chartHeight - hIn}
                      width={barWidth - 1}
                      height={Math.max(2, hIn)}
                      rx={3}
                      className="fill-emerald-600 transition-all duration-300"
                    />
                    {/* Bar Out */}
                    <rect
                      x={x0 + barWidth}
                      y={chartHeight - hOut}
                      width={barWidth - 1}
                      height={Math.max(2, hOut)}
                      rx={3}
                      className="fill-amber-500 transition-all duration-300"
                    />
                    {/* Month label */}
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

        {/* Agenda Terdekat */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Agenda & Kegiatan</h3>
              <p className="text-xs text-slate-500">Kegiatan warga yang akan datang</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('agenda')}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Semua Agenda</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-3">
            {data.agenda && data.agenda.length > 0 ? (
              data.agenda.map((ag) => (
                <div
                  key={ag.ID}
                  className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="w-11 h-11 rounded-lg bg-emerald-100 text-emerald-800 flex flex-col items-center justify-center shrink-0 font-bold leading-none">
                    <span className="text-xs">{ag.Tanggal.slice(8)}</span>
                    <span className="text-[10px] font-semibold uppercase mt-0.5">
                      {periodeLabel(ag.Tanggal.slice(0, 7)).slice(0, 3)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                      {ag.Judul}
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                      {ag.Waktu && <span>{ag.Waktu} WIB</span>}
                      {ag.Waktu && ag.Lokasi && <span aria-hidden="true">·</span>}
                      {ag.Lokasi && <span className="truncate">{ag.Lokasi}</span>}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                <Calendar className="w-6 h-6 mb-1 text-slate-300" />
                <span>Belum ada agenda terdekat.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Informasi & Pengumuman Terbaru */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Pengumuman & Informasi Warga</h3>
            <p className="text-xs text-slate-500">Pemberitahuan resmi dari pengurus RT</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('info')}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Lihat Semua</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.info && data.info.length > 0 ? (
            data.info.map((inf) => (
              <div key={inf.ID} className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                      {inf.Kategori}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatTanggalIndo(inf.TanggalTerbit)}
                    </span>
                  </div>
                  <h4 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-1">{inf.Judul}</h4>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed whitespace-pre-line">
                    {inf.Isi}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/40 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Oleh: {inf.DibuatOleh}</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('info')}
                    className="text-emerald-700 font-semibold hover:underline"
                  >
                    Baca selengkapnya
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 text-center col-span-2 py-6">
              Belum ada informasi yang dipublikasikan.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Mini coins helper icon
function CoinsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  );
}
