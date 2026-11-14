import React, { useState } from 'react';
import { dbService } from '../services/spreadsheetDb';
import { UserSession } from '../types/database';
import { Modal } from './Modal';
import { useToast } from './Toast';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: UserSession;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  session,
}) => {
  const { toast } = useToast();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session.id) return;
    if (newPw !== confirmPw) {
      toast('Konfirmasi password baru tidak cocok.', 'error');
      return;
    }
    try {
      dbService.changeOwnPassword(session.id, oldPw, newPw);
      toast('Password Anda berhasil diubah.', 'success');
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ubah Password Akun Pengurus"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Password Lama *
          </label>
          <input
            type="password"
            required
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Password Baru (Min. 6 Karakter) *
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Ulangi Password Baru *
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Simpan Password Baru
          </button>
        </div>
      </form>
    </Modal>
  );
};
