import React, { useState } from 'react';
import { CheckCircle2, Link2, RefreshCw, TriangleAlert } from 'lucide-react';
import { dbService } from '../services/spreadsheetDb';
import { checkSpreadsheetConnection, normalizeAppsScriptUrl } from '../services/appsScriptConnection';
import type { SpreadsheetConnection } from '../services/appsScriptConnection';
import type { UserSession } from '../types/database';
import { useToast } from './Toast';

interface SpreadsheetConnectionPanelProps {
  session: UserSession;
}

export const SpreadsheetConnectionPanel: React.FC<SpreadsheetConnectionPanelProps> = ({ session }) => {
  const { toast } = useToast();
  const settings = dbService.getSettings();
  const savedUrl = settings.GoogleWebAppUrl || '';
  const [webAppUrl, setWebAppUrl] = useState(savedUrl);
  const [currentUrl, setCurrentUrl] = useState(savedUrl);
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState<SpreadsheetConnection | null>(
    settings.GoogleSpreadsheetConnectionTitle && settings.GoogleSpreadsheetConnectionCheckedAt
      ? {
          spreadsheetTitle: settings.GoogleSpreadsheetConnectionTitle,
          checkedAt: settings.GoogleSpreadsheetConnectionCheckedAt,
        }
      : null
  );
  const [error, setError] = useState('');
  const hasUnsavedUrl = webAppUrl.trim() !== currentUrl;

  const handleSave = () => {
    try {
      const normalizedUrl = normalizeAppsScriptUrl(webAppUrl);
      dbService.setGoogleWebAppUrl(normalizedUrl, session.nama);
      setWebAppUrl(normalizedUrl);
      setCurrentUrl(normalizedUrl);
      setConnection(null);
      setError('');
      toast('URL Web App Apps Script berhasil disimpan.', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast(message, 'error');
    }
  };

  const handleCheck = async () => {
    if (!currentUrl) {
      toast('Simpan URL Web App terlebih dahulu.', 'error');
      return;
    }

    setChecking(true);
    setConnection(null);
    setError('');
    try {
      const result = await checkSpreadsheetConnection(currentUrl);
      dbService.setGoogleSpreadsheetConnectionStatus(result.spreadsheetTitle, result.checkedAt);
      setConnection(result);
      toast(`Terhubung ke ${result.spreadsheetTitle}.`, 'success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  };

  const formatCheckedAt = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'waktu tidak tersedia'
      : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  return (
    <section className="bg-white rounded-2xl border border-emerald-200/80 shadow-xs p-5 space-y-4">
      <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
        <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
          <Link2 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">Koneksi Spreadsheet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Periksa apakah Web App Apps Script dapat mengakses Spreadsheet RT. Pemeriksaan ini tidak membaca atau mengubah data warga.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="google-web-app-url" className="block text-xs font-semibold text-slate-700">
          URL Web App Apps Script
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="google-web-app-url"
            type="url"
            value={webAppUrl}
            onChange={(event) => setWebAppUrl(event.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Simpan URL
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="button"
          onClick={handleCheck}
          disabled={!currentUrl || checking || hasUnsavedUrl}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Memeriksa...' : 'Cek Koneksi'}
        </button>

        {!currentUrl && <span className="text-xs text-slate-500">Belum dikonfigurasi.</span>}
        {hasUnsavedUrl && <span className="text-xs text-amber-700">Simpan URL baru sebelum memeriksa koneksi.</span>}
        {currentUrl && !checking && !connection && !error && !hasUnsavedUrl && (
          <span className="text-xs text-amber-700">URL tersimpan, belum diperiksa.</span>
        )}
        {connection && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            Terhubung terakhir ke {connection.spreadsheetTitle} · {formatCheckedAt(connection.checkedAt)}.
          </span>
        )}
        {error && (
          <span className="inline-flex items-center gap-1.5 text-xs text-rose-700">
            <TriangleAlert className="w-4 h-4 shrink-0" />
            {error}
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        URL ini hanya untuk pemeriksaan kesehatan. Penyimpanan data pusat memakai API Vercel dan rahasia server; jalankan <span className="font-mono">setupSpreadsheetDatabase</span> saat memasang <span className="font-mono">CODE.gs</span> baru.
      </p>
    </section>
  );
};
