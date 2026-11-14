import React from 'react';
import { UserSession } from '../types/database';
import {
  Home,
  Receipt,
  Wallet,
  Users,
  Coins,
  CalendarDays,
  Megaphone,
  Settings,
} from 'lucide-react';

export type PageId = 'dash' | 'iuran' | 'uang' | 'warga' | 'kas' | 'agenda' | 'info' | 'admin';

interface NavigationProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  session: UserSession;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentPage,
  onNavigate,
  session,
}) => {
  const isWarga = session.type === 'warga';
  const isAdmin = session.perm.admin;

  const wargaNavItems: { id: PageId; label: string; icon: React.ElementType }[] = [
    { id: 'dash', label: 'Beranda', icon: Home },
    { id: 'iuran', label: 'Iuran Saya', icon: Receipt },
    { id: 'uang', label: 'Keuangan RT', icon: Wallet },
    { id: 'agenda', label: 'Agenda', icon: CalendarDays },
    { id: 'info', label: 'Informasi', icon: Megaphone },
  ];

  const pengurusNavItems: { id: PageId; label: string; icon: React.ElementType }[] = [
    { id: 'dash', label: 'Beranda', icon: Home },
    { id: 'warga', label: 'Warga & Rumah', icon: Users },
    { id: 'kas', label: 'Kas & Iuran', icon: Coins },
    { id: 'agenda', label: 'Agenda', icon: CalendarDays },
    { id: 'info', label: 'Informasi', icon: Megaphone },
    ...(isAdmin ? [{ id: 'admin' as PageId, label: 'Panel Admin', icon: Settings }] : []),
  ];

  const items = isWarga ? wargaNavItems : pengurusNavItems;

  return (
    <>
      {/* Desktop & Tablet Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-white border-r border-slate-200/80 p-4 shrink-0">
        <div className="space-y-1">
          <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Menu Utama
          </span>
          {items.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all text-left cursor-pointer ${
                  active
                    ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Database indicator in sidebar */}
        <div className="mt-auto pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-xs text-slate-600">
            <div className="font-semibold text-slate-800 flex items-center justify-between mb-1">
              <span>Database</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Aktif"></span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Spreadsheet aktif · {session.role}
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (15% cap compliant) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/90 py-1 px-2 flex justify-around items-center shadow-lg safe-bottom">
        {items.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all ${
                active ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 mb-0.5 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
