import React, { useState } from 'react';
import { dbService } from '../services/spreadsheetDb';
import { UserSession } from '../types/database';
import { useToast } from '../components/Toast';
import { Building2, KeyRound, Lock, User, Home, ShieldCheck } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { toast } = useToast();
  const publicInfo = dbService.getPublicInfo();

  const [activeTab, setActiveTab] = useState<'warga' | 'pengurus'>('warga');

  // Warga state
  const [selectedAlamat, setSelectedAlamat] = useState<string>('');
  const [wargaPin, setWargaPin] = useState<string>('');
  const [loadingWarga, setLoadingWarga] = useState(false);

  // Pengurus state
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loadingPengurus, setLoadingPengurus] = useState(false);

  const handleWargaLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlamat) {
      toast('Silakan pilih alamat rumah Anda.', 'error');
      return;
    }
    setLoadingWarga(true);
    try {
      const { session } = dbService.loginWarga(selectedAlamat, wargaPin);
      toast(`Selamat datang di ${publicInfo.namaAplikasi}!`, 'success');
      onLoginSuccess(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    } finally {
      setLoadingWarga(false);
    }
  };

  const handlePengurusLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast('Username dan password wajib diisi.', 'error');
      return;
    }
    setLoadingPengurus(true);
    try {
      const { session } = dbService.loginPengurus(username, password);
      toast(`Login berhasil sebagai ${session.nama} (${session.role})`, 'success');
      onLoginSuccess(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    } finally {
      setLoadingPengurus(false);
    }
  };

  const fillPengurusPreset = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 mb-3">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {publicInfo.namaAplikasi}
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Sistem Informasi Warga RT 07 Bintang Metropol
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-7 bg-white py-7 px-5 sm:px-8 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200/80">
          {/* Segmented Control Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('warga')}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'warga'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Login Warga</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pengurus')}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'pengurus'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Login Pengurus</span>
            </button>
          </div>

          {/* Form Warga */}
          {activeTab === 'warga' && (
            <form onSubmit={handleWargaLogin} className="space-y-4">
              <div>
                <label htmlFor="alamat-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Pilih Alamat Rumah
                </label>
                <div className="relative">
                  <select
                    id="alamat-select"
                    value={selectedAlamat}
                    onChange={(e) => setSelectedAlamat(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="">
                      {publicInfo.daftarAlamat.length > 0
                        ? '— Pilih nomor rumah Anda —'
                        : '— Belum ada data rumah terdaftar —'}
                    </option>
                    {publicInfo.daftarAlamat.map((alm) => (
                      <option key={alm} value={alm}>
                        Rumah {alm}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    ▼
                  </div>
                </div>
              </div>

              {/* Quick house selector */}
              {publicInfo.daftarAlamat.length > 0 && (
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block mb-1">Pilih cepat rumah:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {publicInfo.daftarAlamat.slice(0, 4).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setSelectedAlamat(a)}
                        className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors ${
                          selectedAlamat === a
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Rumah {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {publicInfo.pinWargaAktif && (
                <div>
                  <label htmlFor="warga-pin" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    PIN Rumah (4-6 digit)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      id="warga-pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={wargaPin}
                      onChange={(e) => setWargaPin(e.target.value)}
                      placeholder="Masukkan PIN rumah"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-mono"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loadingWarga}
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
              >
                {loadingWarga ? 'Memproses...' : 'Masuk Sebagai Warga'}
              </button>
            </form>
          )}

          {/* Form Pengurus (Strictly Username & Password - NO GOOGLE) */}
          {activeTab === 'pengurus' && (
            <form onSubmit={handlePengurusLogin} className="space-y-4">

              <div>
                <label htmlFor="pengurus-username" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="pengurus-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pengurus-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="pengurus-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-mono"
                    required
                  />
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => fillPengurusPreset('admin', 'admin123')}
                  className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 transition-colors flex items-center justify-between"
                >
                  <span className="text-xs font-semibold text-slate-700">Akun Admin Default</span>
                  <span className="text-[11px] text-slate-500 font-mono">admin / admin123</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={loadingPengurus}
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
              >
                {loadingPengurus ? 'Memverifikasi...' : 'Masuk Sebagai Pengurus'}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-400">
          <p>© {new Date().getFullYear()} {publicInfo.namaAplikasi}</p>
        </div>
      </div>
    </div>
  );
};
