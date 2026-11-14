import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  ExternalLink,
  FilePlus2,
  FolderSearch,
  Link2,
  LogOut,
  RefreshCw,
  Table2,
  Unlink,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { dbService } from '../services/spreadsheetDb';
import {
  createRT07Spreadsheet,
  DriveSpreadsheetFile,
  extractSpreadsheetId,
  getAccessToken,
  getSpreadsheetMetadata,
  googleSignIn,
  googleSignOut,
  initGoogleAuth,
  listGoogleSpreadsheets,
  pullDatabaseFromSpreadsheet,
  pushDatabaseToSpreadsheet,
  readSheetValues,
  SpreadsheetMetadata,
} from '../services/googleSheetsService';
import { SpreadsheetDatabase, UserSession } from '../types/database';
import { GoogleSignInButton } from './GoogleSignInButton';
import { Modal } from './Modal';
import { useToast } from './Toast';

interface GoogleSheetsSyncPanelProps {
  session: UserSession;
  onDatabaseUpdated: () => void;
}

type ConfirmDialogState =
  | {
      type: 'create';
      title: string;
    }
  | {
      type: 'push';
      spreadsheetId: string;
      spreadsheetTitle: string;
      sheetCount: number;
      totalRows: number;
    }
  | {
      type: 'pull';
      spreadsheetId: string;
      spreadsheetTitle: string;
      tabCounts: { sheet: keyof SpreadsheetDatabase; actualTitle: string; count: number }[];
      unmatchedTabs: string[];
      importedData: Partial<SpreadsheetDatabase>;
    }
  | null;

export const GoogleSheetsSyncPanel: React.FC<GoogleSheetsSyncPanelProps> = ({
  session,
  onDatabaseUpdated,
}) => {
  const { toast } = useToast();

  // Google Auth State (token cached strictly in-memory inside googleSheetsService)
  const [needsAuth, setNeedsAuth] = useState(true);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Linked Spreadsheet State
  const initialSettings = dbService.getSettings();
  const [linkedId, setLinkedId] = useState<string>(initialSettings.GoogleSpreadsheetId || '');
  const [metadata, setMetadata] = useState<SpreadsheetMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Drive picker & manual ID input
  const [manualUrlOrId, setManualUrlOrId] = useState('');
  const [newSheetTitle, setNewSheetTitle] = useState('Database RT 07 GO DIGITAL');
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [driveSearch, setDriveSearch] = useState('');
  const [loadingDrive, setLoadingDrive] = useState(false);

  // Live tab preview
  const [previewTab, setPreviewTab] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Explicit confirmation modal for any create/push/pull operation
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [busyAction, setBusyAction] = useState(false);

  useEffect(() => {
    const unsub = initGoogleAuth(
      (user) => {
        setGoogleUser(user);
        setNeedsAuth(false);
      },
      () => {
        setGoogleUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsub();
  }, []);

  const loadMetadata = async (idToLoad: string) => {
    if (!idToLoad) {
      setMetadata(null);
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setLoadingMeta(true);
    try {
      const meta = await getSpreadsheetMetadata(token, idToLoad);
      setMetadata(meta);
      if (meta.sheets.length > 0 && !meta.sheets.some((s) => s.title === previewTab)) {
        setPreviewTab(meta.sheets[0].title);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`Gagal memuat metadata Google Sheets: ${msg}`, 'error');
      const currentToken = await getAccessToken();
      if (!currentToken) setNeedsAuth(true);
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    if (!needsAuth && linkedId) {
      loadMetadata(linkedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAuth, linkedId]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      setGoogleUser(res.user);
      setNeedsAuth(false);
      toast(`Terhubung ke akun Google (${res.user.email || res.user.displayName}).`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`Gagal masuk Google: ${msg}`, 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await googleSignOut();
    setGoogleUser(null);
    setNeedsAuth(true);
    setMetadata(null);
    setPreviewRows([]);
    toast('Koneksi akun Google telah diputuskan.', 'info');
  };

  const handleOpenDrivePicker = async () => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      toast('Silakan Sign in with Google terlebih dahulu.', 'error');
      return;
    }
    setDriveModalOpen(true);
    setLoadingDrive(true);
    try {
      const files = await listGoogleSpreadsheets(token, driveSearch);
      setDriveFiles(files);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`Gagal membaca daftar Google Drive: ${msg}`, 'error');
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleSearchDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setLoadingDrive(true);
    try {
      const files = await listGoogleSpreadsheets(token, driveSearch);
      setDriveFiles(files);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`Pencarian Drive gagal: ${msg}`, 'error');
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleSelectDriveFile = async (file: DriveSpreadsheetFile) => {
    dbService.setLinkedSpreadsheet(file.id, file.name, session.nama);
    setLinkedId(file.id);
    setDriveModalOpen(false);
    setPreviewRows([]);
    toast(`Spreadsheet "${file.name}" berhasil ditautkan.`, 'success');
  };

  const handleLinkManualId = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = extractSpreadsheetId(manualUrlOrId);
    if (!cleanId) {
      toast('Masukkan ID atau URL Google Sheets yang valid.', 'error');
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      toast('Silakan Sign in with Google terlebih dahulu.', 'error');
      return;
    }
    setLoadingMeta(true);
    try {
      const meta = await getSpreadsheetMetadata(token, cleanId);
      dbService.setLinkedSpreadsheet(meta.spreadsheetId, meta.title, session.nama);
      setLinkedId(meta.spreadsheetId);
      setMetadata(meta);
      setManualUrlOrId('');
      if (meta.sheets.length > 0) setPreviewTab(meta.sheets[0].title);
      toast(`Terhubung ke Google Sheets "${meta.title}".`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`Spreadsheet tidak dapat diakses: ${msg}`, 'error');
    } finally {
      setLoadingMeta(false);
    }
  };

  const handleUnlinkSpreadsheet = () => {
    dbService.setLinkedSpreadsheet('', '', session.nama);
    setLinkedId('');
    setMetadata(null);
    setPreviewRows([]);
    toast('Tautan spreadsheet dilepas.', 'info');
  };

  const handleLoadPreviewTab = async (tabTitle: string) => {
    if (!linkedId || !tabTitle) return;
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setPreviewTab(tabTitle);
    setLoadingPreview(true);
    try {
      const rows = await readSheetValues(token, linkedId, tabTitle);
      setPreviewRows(rows);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`Gagal membaca tab "${tabTitle}": ${msg}`, 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Prepare confirmation dialogs before executing any mutating operation
  const handlePreparePush = () => {
    if (!metadata) return;
    const raw = dbService.getRawDatabase();
    const keys = Object.keys(raw) as (keyof SpreadsheetDatabase)[];
    const totalRows = keys.reduce((acc, k) => acc + (raw[k]?.length || 0), 0);
    setConfirmDialog({
      type: 'push',
      spreadsheetId: metadata.spreadsheetId,
      spreadsheetTitle: metadata.title,
      sheetCount: keys.length,
      totalRows,
    });
  };

  const handlePreparePull = async () => {
    if (!metadata) return;
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      toast('Silakan Sign in with Google terlebih dahulu.', 'error');
      return;
    }
    setBusyAction(true);
    try {
      const res = await pullDatabaseFromSpreadsheet(token, metadata.spreadsheetId);
      setConfirmDialog({
        type: 'pull',
        spreadsheetId: metadata.spreadsheetId,
        spreadsheetTitle: res.metadata.title,
        tabCounts: res.tabCounts,
        unmatchedTabs: res.unmatchedTabs,
        importedData: res.data,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`Gagal membaca Google Sheets: ${msg}`, 'error');
    } finally {
      setBusyAction(false);
    }
  };

  const handleExecuteConfirmedAction = async () => {
    if (!confirmDialog) return;
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      setConfirmDialog(null);
      toast('Sesi Google berakhir. Silakan Sign in with Google lagi.', 'error');
      return;
    }

    setBusyAction(true);
    try {
      if (confirmDialog.type === 'create') {
        const raw = dbService.getRawDatabase();
        const meta = await createRT07Spreadsheet(token, confirmDialog.title, raw);
        dbService.setLinkedSpreadsheet(meta.spreadsheetId, meta.title, session.nama);
        setLinkedId(meta.spreadsheetId);
        setMetadata(meta);
        if (meta.sheets.length > 0) setPreviewTab(meta.sheets[0].title);
        toast(`Google Spreadsheet "${meta.title}" berhasil dibuat dan diisi data RT 07.`, 'success');
        onDatabaseUpdated();
      } else if (confirmDialog.type === 'push') {
        const raw = dbService.getRawDatabase();
        const res = await pushDatabaseToSpreadsheet(token, confirmDialog.spreadsheetId, raw);
        dbService.logAction(
          session.nama,
          'SYNC_TO_GSHEET',
          `Sinkronisasi ${res.totalRows} baris ke ${confirmDialog.spreadsheetTitle}`
        );
        toast(
          `Berhasil mengirim ${res.totalRows} baris ke ${res.updatedSheets.length} tab di Google Sheets.`,
          'success'
        );
        await loadMetadata(confirmDialog.spreadsheetId);
        if (previewTab) await handleLoadPreviewTab(previewTab);
        onDatabaseUpdated();
      } else if (confirmDialog.type === 'pull') {
        dbService.importSheetJson(confirmDialog.importedData, session.nama);
        dbService.setLinkedSpreadsheet(
          confirmDialog.spreadsheetId,
          confirmDialog.spreadsheetTitle,
          session.nama
        );
        toast(
          `Berhasil memuat data dari Google Sheets "${confirmDialog.spreadsheetTitle}" ke aplikasi.`,
          'success'
        );
        onDatabaseUpdated();
      }
      setConfirmDialog(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`Operasi gagal: ${msg}`, 'error');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-xs p-5 space-y-4">
      {/* Header & Auth Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <Cloud className="w-4 h-4 text-emerald-600" />
            <span>Integrasi Google Sheets & Google Drive</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Hubungkan aplikasi ke Google Sheets milik pengurus untuk sinkronisasi, cadangan cloud, dan pembacaan data langsung.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {needsAuth ? (
            <GoogleSignInButton
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              label={isLoggingIn ? 'Menghubungkan...' : 'Sign in with Google'}
            />
          ) : (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-emerald-950 leading-tight">
                  {googleUser?.displayName || 'Akun Google Terhubung'}
                </div>
                {googleUser?.email && (
                  <div className="text-[11px] text-emerald-700 font-mono">{googleUser.email}</div>
                )}
              </div>
              <button
                type="button"
                onClick={handleGoogleLogout}
                className="ml-2 p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
                title="Putuskan Akun Google"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body when NOT authenticated with Google */}
      {needsAuth && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-800 mb-0.5">
              Belum terhubung ke Google Sheets
            </p>
            <p>
              Klik tombol <b>Sign in with Google</b> untuk memilih file Google Sheets dari Drive Anda, membuat spreadsheet database baru, atau menyinkronkan data RT 07.
              {linkedId && (
                <span className="block mt-1 text-emerald-700 font-mono">
                  ID Spreadsheet tersimpan: {linkedId}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Body when authenticated with Google */}
      {!needsAuth && (
        <div className="space-y-4">
          {/* Linked Spreadsheet Card OR Setup Controls */}
          {linkedId ? (
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 block">
                    Google Spreadsheet Tertaut
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                    {loadingMeta ? 'Memuat info spreadsheet...' : metadata?.title || initialSettings.GoogleSpreadsheetTitle || linkedId}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500 break-all">
                    ID: {linkedId}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {metadata?.spreadsheetUrl && (
                    <a
                      href={metadata.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
                    >
                      <span>Buka di Google Sheets</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => loadMetadata(linkedId)}
                    disabled={loadingMeta}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    title="Muat ulang metadata"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingMeta ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={handleUnlinkSpreadsheet}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    title="Putuskan tautan spreadsheet ini"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Ganti File</span>
                  </button>
                </div>
              </div>

              {/* Sync Buttons */}
              <div className="pt-3 border-t border-emerald-200/70 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePreparePush}
                  disabled={busyAction || !metadata}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CloudUpload className="w-4 h-4" />
                  <span>Kirim Data Aplikasi &rarr; Google Sheets</span>
                </button>

                <button
                  type="button"
                  onClick={handlePreparePull}
                  disabled={busyAction || !metadata}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CloudDownload className="w-4 h-4 text-sky-600" />
                  <span>Ambil Data Google Sheets &rarr; Aplikasi</span>
                </button>
              </div>

              {/* Live Tabs Metadata & Preview Trigger */}
              {metadata && metadata.sheets.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                    <Table2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tab Tersedia di Google Sheets ({metadata.sheets.length}) — klik tab untuk pratinjau langsung:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {metadata.sheets.map((s) => (
                      <button
                        key={s.sheetId}
                        type="button"
                        onClick={() => handleLoadPreviewTab(s.title)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          previewTab === s.title && previewRows.length > 0
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Sheet Values Preview Table */}
              {loadingPreview && (
                <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
                  Membaca data tab "{previewTab}" dari Google Sheets...
                </div>
              )}

              {!loadingPreview && previewRows.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      Pratinjau Langsung Tab: <span className="font-mono text-emerald-700">{previewTab}</span>
                    </span>
                    <span className="text-slate-400">
                      {Math.max(0, previewRows.length - 1)} baris data
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-slate-100 text-slate-600 sticky top-0 border-b border-slate-200">
                        <tr>
                          {(previewRows[0] || []).map((col, i) => (
                            <th key={i} className="px-3 py-1.5 whitespace-nowrap font-bold">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewRows.slice(1, 51).map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50">
                            {(previewRows[0] || []).map((_, cIdx) => (
                              <td key={cIdx} className="px-3 py-1.5 text-slate-700 max-w-xs truncate whitespace-nowrap">
                                {row[cIdx] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {previewRows.length <= 1 && (
                          <tr>
                            <td colSpan={Math.max(1, previewRows[0]?.length || 1)} className="px-3 py-4 text-center text-slate-400 font-sans">
                              Tab ini hanya berisi baris header (belum ada data).
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Option A: Create new Google Spreadsheet */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900 text-xs sm:text-sm">
                  <FilePlus2 className="w-4 h-4 text-emerald-600" />
                  <span>Buat Google Spreadsheet Baru</span>
                </div>
                <p className="text-xs text-slate-500">
                  Otomatis membuat file Google Sheets baru di Google Drive Anda lengkap dengan 12 tab tabel RT 07.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    placeholder="Nama file spreadsheet..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDialog({
                        type: 'create',
                        title: newSheetTitle.trim() || 'Database RT 07 GO DIGITAL',
                      })
                    }
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    + Buat Spreadsheet
                  </button>
                </div>
              </div>

              {/* Option B: Pick from Google Drive or Paste URL */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900 text-xs sm:text-sm">
                  <FolderSearch className="w-4 h-4 text-sky-600" />
                  <span>Hubungkan Spreadsheet yang Sudah Ada</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleOpenDrivePicker}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <FolderSearch className="w-3.5 h-3.5 text-sky-600" />
                    <span>Pilih dari Google Drive</span>
                  </button>
                </div>
                <form onSubmit={handleLinkManualId} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={manualUrlOrId}
                    onChange={(e) => setManualUrlOrId(e.target.value)}
                    placeholder="Atau tempel URL / Spreadsheet ID..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={loadingMeta}
                    className="inline-flex items-center justify-center gap-1 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>{loadingMeta ? 'Menghubungkan...' : 'Hubungkan'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DRIVE PICKER MODAL */}
      {driveModalOpen && (
        <Modal
          isOpen={driveModalOpen}
          onClose={() => setDriveModalOpen(false)}
          title="Pilih Google Spreadsheet dari Google Drive"
          maxWidth="lg"
        >
          <div className="space-y-3">
            <form onSubmit={handleSearchDrive} className="flex gap-2">
              <input
                type="text"
                value={driveSearch}
                onChange={(e) => setDriveSearch(e.target.value)}
                placeholder="Cari nama file spreadsheet..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={loadingDrive}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cari
              </button>
            </form>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {loadingDrive ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Memuat daftar Google Spreadsheets...
                </div>
              ) : driveFiles.length > 0 ? (
                driveFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => handleSelectDriveFile(file)}
                    className="w-full text-left px-4 py-3 hover:bg-emerald-50/70 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                        {file.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        {file.id}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold shrink-0">
                      Pilih
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  Tidak ada Google Spreadsheet ditemukan di Google Drive Anda.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* MANDATORY USER CONFIRMATION DIALOG FOR CREATE / PUSH / PULL */}
      {confirmDialog && (
        <Modal
          isOpen={Boolean(confirmDialog)}
          onClose={() => !busyAction && setConfirmDialog(null)}
          title={
            confirmDialog.type === 'create'
              ? 'Konfirmasi Buat Google Spreadsheet'
              : confirmDialog.type === 'push'
              ? 'Konfirmasi Kirim Data ke Google Sheets'
              : 'Konfirmasi Ambil Data dari Google Sheets'
          }
          maxWidth="md"
        >
          <div className="space-y-4 text-xs sm:text-sm text-slate-700">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                {confirmDialog.type === 'create' && (
                  <>
                    <p className="font-bold">Buat file baru di Google Drive Anda?</p>
                    <p className="text-xs">
                      Aplikasi akan membuat spreadsheet baru berjudul <b>"{confirmDialog.title}"</b> dan menulis seluruh 12 tab data RT 07 ke dalamnya.
                    </p>
                  </>
                )}
                {confirmDialog.type === 'push' && (
                  <>
                    <p className="font-bold">Perbarui dan timpa isi Google Sheets?</p>
                    <p className="text-xs">
                      Isi pada <b>{confirmDialog.sheetCount} tab</b> di spreadsheet <b>"{confirmDialog.spreadsheetTitle}"</b> akan dibersihkan lalu ditulis ulang dengan <b>{confirmDialog.totalRows} baris</b> data aplikasi saat ini.
                    </p>
                  </>
                )}
                {confirmDialog.type === 'pull' && (
                  <>
                    <p className="font-bold">Timpa database aplikasi lokal dari Google Sheets?</p>
                    <p className="text-xs">
                      Data lokal aplikasi saat ini akan diganti dengan data yang terbaca dari spreadsheet <b>"{confirmDialog.spreadsheetTitle}"</b>.
                    </p>
                  </>
                )}
              </div>
            </div>

            {confirmDialog.type === 'pull' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="font-semibold text-slate-800">
                  Tab yang akan dimuat ({confirmDialog.tabCounts.length} tab):
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                  {confirmDialog.tabCounts.map((t) => (
                    <div
                      key={t.sheet}
                      className="flex items-center justify-between bg-white px-2.5 py-1 rounded-lg border border-slate-200"
                    >
                      <span className="font-mono text-slate-700">{t.actualTitle}</span>
                      <span className="font-bold text-emerald-700">{t.count} baris</span>
                    </div>
                  ))}
                </div>
                {confirmDialog.unmatchedTabs.length > 0 && (
                  <p className="text-[11px] text-slate-400 pt-1">
                    Tab lain dilewati: {confirmDialog.unmatchedTabs.join(', ')}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busyAction}
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={handleExecuteConfirmedAction}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {busyAction
                  ? 'Memproses...'
                  : confirmDialog.type === 'create'
                  ? 'Ya, Buat & Isi Spreadsheet'
                  : confirmDialog.type === 'push'
                  ? 'Ya, Kirim ke Google Sheets'
                  : 'Ya, Muat Data ke Aplikasi'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
