import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal } from './Modal';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

export const useConfirm = () => useContext(ConfirmContext);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve: (confirmed: boolean) => void }) | null>(null);
  const queueRef = useRef<(ConfirmOptions & { resolve: (confirmed: boolean) => void })[]>([]);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const showNext = useCallback(() => {
    setRequest(queueRef.current.shift() || null);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => new Promise<boolean>((resolve) => {
    queueRef.current.push({ ...next, resolve });
    setRequest((current) => current || queueRef.current.shift() || null);
  }), []);

  const close = (confirmed: boolean) => {
    if (!request) return;
    request.resolve(confirmed);
    showNext();
  };

  const descriptionId = 'confirm-dialog-description';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        isOpen={Boolean(request)}
        onClose={() => close(false)}
        title={request?.title || 'Konfirmasi'}
        maxWidth="sm"
        role="alertdialog"
        describedBy={descriptionId}
        initialFocusRef={cancelRef}
        footer={
          <>
            <button ref={cancelRef} type="button" onClick={() => close(false)} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors">
              {request?.cancelLabel || 'Batal'}
            </button>
            <button type="button" onClick={() => close(true)} className={`px-4 py-2 rounded-xl text-white text-sm font-semibold transition-colors ${request?.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {request?.confirmLabel || 'Lanjutkan'}
            </button>
          </>
        }
      >
        <p id={descriptionId}>{request?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
};
