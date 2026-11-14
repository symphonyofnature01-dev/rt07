import React from 'react';
import { UserSession } from '../types/database';
import { Building2, Key, LogOut } from 'lucide-react';

interface HeaderProps {
  session: UserSession;
  namaAplikasi: string;
  namaRT: string;
  onOpenChangePassword?: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  namaAplikasi,
  namaRT,
  onOpenChangePassword,
  onLogout,
}) => {
  const isWarga = session.type === 'warga';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
          <Building2 className="w-4 h-4" />
        </div>
        <div>
          <span className="text-base font-bold text-slate-900 tracking-tight whitespace-nowrap block leading-tight">
            {namaAplikasi}
          </span>
          <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap block">
            {namaRT} · Portal Digital
          </span>
        </div>
      </div>

      {/* Zone 2: Context Tag / User Greeting */}
      <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-700">{session.nama}</span>
        <span aria-hidden="true">·</span>
        <span className="font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
          {isWarga ? 'Warga RT' : session.jabatan || session.role}
        </span>
      </div>

      {/* Zone 3: Quick Action / User Menu */}
      <div className="flex items-center gap-2 shrink-0">
        {!isWarga && onOpenChangePassword && (
          <button
            type="button"
            onClick={onOpenChangePassword}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/60"
            title="Ganti Password Akun Pengurus"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Ganti Password</span>
          </button>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 cursor-pointer"
          title="Keluar dari Aplikasi"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>
      </div>
    </header>
  );
};
