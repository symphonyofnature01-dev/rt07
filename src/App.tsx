/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { dbService } from './services/spreadsheetDb';
import { UserSession } from './types/database';
import { ToastProvider, useToast } from './components/Toast';
import { Header } from './components/Header';
import { Navigation, PageId } from './components/Navigation';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { RumahWargaView } from './views/RumahWargaView';
import { KasIuranView } from './views/KasIuranView';
import { RiwayatBayarWargaView } from './views/RiwayatBayarWargaView';
import { KeuanganPublikView } from './views/KeuanganPublikView';
import { AgendaView } from './views/AgendaView';
import { InformasiView } from './views/InformasiView';
import { AdminView } from './views/AdminView';
import { PaymentModal } from './components/PaymentModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';

function AppContent() {
  const { toast } = useToast();
  const [session, setSession] = useState<UserSession | null>(() => dbService.getCurrentSession());
  const [currentPage, setCurrentPage] = useState<PageId>('dash');
  const [kasInitialTab, setKasInitialTab] = useState<string>('buku');
  const [targetRiwayatAlamat, setTargetRiwayatAlamat] = useState<string>('');

  // Modals state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalAlamat, setPaymentModalAlamat] = useState<string | undefined>(undefined);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // App settings for header
  const settings = dbService.getSettings();
  const namaAplikasi = settings.NamaAplikasi || 'RT 07 GO DIGITAL';
  const namaRT = settings.NamaRT || 'RT 07';

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    setCurrentPage('dash');
  };

  const handleLogout = () => {
    dbService.clearSession();
    setSession(null);
    setCurrentPage('dash');
    toast('Anda telah keluar dari aplikasi.', 'info');
  };

  const handleNavigate = (page: PageId, tab?: string) => {
    if (page === 'kas' && tab) {
      setKasInitialTab(tab);
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenRiwayatRumah = (alamat: string) => {
    setTargetRiwayatAlamat(alamat);
    setCurrentPage('iuran');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenBayarModal = (alamat?: string) => {
    setPaymentModalAlamat(alamat);
    setPaymentModalOpen(true);
  };

  // If not logged in, render the clean LoginView
  if (!session) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Top Bar Header */}
      <Header
        session={session}
        namaAplikasi={namaAplikasi}
        namaRT={namaRT}
        onOpenChangePassword={() => setChangePasswordOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Sidebar Navigation */}
        <Navigation
          currentPage={currentPage}
          onNavigate={(p) => handleNavigate(p)}
          session={session}
        />

        {/* Content Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8">
          {currentPage === 'dash' && (
            <DashboardView
              session={session}
              onNavigate={handleNavigate}
              onOpenBayar={handleOpenBayarModal}
            />
          )}

          {currentPage === 'warga' && (
            <RumahWargaView
              session={session}
              onOpenRiwayat={handleOpenRiwayatRumah}
            />
          )}

          {currentPage === 'kas' && (
            <KasIuranView
              key={kasInitialTab}
              session={session}
              initialTab={kasInitialTab}
              onOpenRiwayat={handleOpenRiwayatRumah}
              onOpenCatatBayarManual={() => handleOpenBayarModal()}
            />
          )}

          {currentPage === 'iuran' && (
            <RiwayatBayarWargaView
              session={session}
              alamatOverride={targetRiwayatAlamat || undefined}
              onOpenBayarModal={(alm) => handleOpenBayarModal(alm)}
            />
          )}

          {currentPage === 'uang' && <KeuanganPublikView session={session} />}

          {currentPage === 'agenda' && <AgendaView session={session} />}

          {currentPage === 'info' && <InformasiView session={session} />}

          {currentPage === 'admin' && session.perm.admin && <AdminView session={session} />}
        </main>
      </div>

      {/* Global Payment / Upload Modal */}
      {paymentModalOpen && (
        <PaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          defaultAlamat={paymentModalAlamat}
          session={session}
          onSuccess={() => {
            // Trigger state refresh
            setSession({ ...session });
          }}
        />
      )}

      {/* Change Password Modal for Pengurus */}
      {changePasswordOpen && (
        <ChangePasswordModal
          isOpen={changePasswordOpen}
          onClose={() => setChangePasswordOpen(false)}
          session={session}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
