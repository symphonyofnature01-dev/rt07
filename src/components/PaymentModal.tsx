import React, { useState, useEffect } from 'react';
import { dbService, formatRupiah, MS, pad2, todayStr } from '../services/spreadsheetDb';
import { KategoriIuranUtama, UserSession } from '../types/database';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { CreditCard, UploadCloud, Check, AlertCircle } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAlamat?: string;
  session: UserSession;
  onSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  defaultAlamat,
  session,
  onSuccess,
}) => {
  const { toast } = useToast();
  const isWarga = session.type === 'warga';
  const rumahList = dbService.listRumah();

  const [selectedAlamat, setSelectedAlamat] = useState<string>(
    defaultAlamat || (isWarga ? session.alamat || '' : rumahList[0]?.Alamat || '')
  );

  const [formBayarData, setFormBayarData] = useState<ReturnType<typeof dbService.getFormBayar> | null>(null);
  const [filterKategori, setFilterKategori] = useState<'' | KategoriIuranUtama>('');
  const [selectedJenis, setSelectedJenis] = useState<string>('');
  const [nominalNonRutin, setNominalNonRutin] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());
  const [tanggalBayar, setTanggalBayar] = useState<string>(todayStr());
  const [metodeBayar, setMetodeBayar] = useState<string>('Transfer');
  const [catatan, setCatatan] = useState<string>('');
  const [filePreview, setFilePreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (defaultAlamat) {
      setSelectedAlamat(defaultAlamat);
    } else if (isWarga && session.alamat) {
      setSelectedAlamat(session.alamat);
    }
  }, [defaultAlamat, isWarga, session.alamat]);

  useEffect(() => {
    if (selectedAlamat) {
      try {
        const data = dbService.getFormBayar(selectedAlamat);
        setFormBayarData(data);
        if (data.jenis.length > 0) {
          setSelectedJenis(data.jenis[0].jenis);
          setNominalNonRutin(data.jenis[0].nominal);
        } else {
          setSelectedJenis('');
          setNominalNonRutin(0);
        }
        setSelectedPeriods(new Set());
      } catch (err: unknown) {
        console.error(err);
      }
    }
  }, [selectedAlamat]);

  if (!isOpen) return null;

  const filteredJenisOptions = (formBayarData?.jenis || []).filter(
    (j) => !filterKategori || j.tipeIuran === filterKategori
  );

  const selectedJenisObj =
    filteredJenisOptions.find((j) => j.jenis === selectedJenis) || filteredJenisOptions[0];
  const currentTipe: KategoriIuranUtama =
    selectedJenisObj?.tipeIuran || (filterKategori === 'Iuran Non Rutin' ? 'Iuran Non Rutin' : 'Iuran Rutin');
  const currentJenisNominal = selectedJenisObj?.nominal || 0;

  // Used periods for current fee type (only applies to Iuran Rutin)
  const usedMap: Record<string, string> = {};
  if (formBayarData && selectedJenisObj && currentTipe === 'Iuran Rutin') {
    (formBayarData.terpakai[selectedJenisObj.jenis] || []).forEach((t) => {
      usedMap[t.periode] = t.status;
    });
  }

  const togglePeriod = (per: string) => {
    if (usedMap[per]) return;
    const next = new Set(selectedPeriods);
    if (next.has(per)) {
      next.delete(per);
    } else {
      next.add(per);
    }
    setSelectedPeriods(next);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast('Ukuran berkas maksimal 5 MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlamat) {
      toast('Alamat rumah wajib dipilih.', 'error');
      return;
    }
    if (!selectedJenisObj) {
      toast('Tarif iuran belum tersedia. Atur nominal iuran terlebih dahulu.', 'error');
      return;
    }
    if (currentTipe === 'Iuran Rutin' && selectedPeriods.size === 0) {
      toast('Pilih minimal satu bulan iuran rutin.', 'error');
      return;
    }
    if (currentTipe === 'Iuran Non Rutin' && (!nominalNonRutin || nominalNonRutin <= 0)) {
      toast('Nominal iuran non rutin harus lebih dari 0.', 'error');
      return;
    }
    if (isWarga && !filePreview) {
      toast('Warga wajib melampirkan foto/file bukti transfer pembayaran.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const autoVerify = !isWarga; // Pengurus recordings are auto-verified
      const result = dbService.createPayments(
        selectedAlamat,
        {
          jenis: selectedJenisObj.jenis,
          tipeIuran: currentTipe,
          periode: currentTipe === 'Iuran Rutin' ? Array.from(selectedPeriods).sort() : [tanggalBayar.slice(0, 7)],
          nominalCustom: currentTipe === 'Iuran Non Rutin' ? nominalNonRutin : undefined,
          tanggalBayar,
          metode: metodeBayar,
          buktiURL: filePreview,
          catatan,
        },
        session.nama,
        autoVerify
      );

      const labelInfo =
        currentTipe === 'Iuran Non Rutin'
          ? `${selectedJenisObj.jenis} (${formatRupiah(result.total)})`
          : `${result.jumlahBulan} bulan (${formatRupiah(result.total)})`;

      if (autoVerify) {
        toast(`Pembayaran ${labelInfo} berhasil dicatat dan masuk Buku Kas.`, 'success');
      } else {
        toast(`Pembayaran ${labelInfo} berhasil dikirim. Menunggu verifikasi pengurus RT.`, 'success');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalBayar =
    currentTipe === 'Iuran Non Rutin'
      ? Number(nominalNonRutin) || 0
      : currentJenisNominal * selectedPeriods.size;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isWarga ? 'Bayar / Unggah Iuran Warga' : 'Catat Pembayaran Iuran (Manual)'}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* House selector (for pengurus) */}
        {!isWarga && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Pilih Alamat Rumah Warga *
            </label>
            {rumahList.length > 0 ? (
              <select
                value={selectedAlamat}
                onChange={(e) => setSelectedAlamat(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
              >
                {rumahList.map((r) => (
                  <option key={r.ID} value={r.Alamat}>
                    Rumah {r.Alamat} - {r.NamaKepalaKeluarga || r.NamaPenghuni || r.NamaPemilik} ({r.StatusHunian})
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                Belum ada data rumah terdaftar. Silakan tambahkan data rumah terlebih dahulu di menu Warga & Rumah.
              </div>
            )}
          </div>
        )}

        {/* Bank Account Info Card */}
        {formBayarData && (
          <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-4 text-xs text-emerald-900 flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 block text-sm">
                Rekening Kas RT: {formBayarData.rekening.bank}
              </span>
              <div className="font-mono text-base font-bold text-emerald-900 my-0.5">
                {formBayarData.rekening.nomor}
              </div>
              <span className="text-slate-600">
                Atas Nama: <b className="text-slate-800">{formBayarData.rekening.atasNama}</b>
              </span>
            </div>
          </div>
        )}

        {/* Category & Fee Type Selector */}
        {formBayarData && (
          formBayarData.jenis.length > 0 ? (
            <div className="space-y-3">
              {/* Kategori Tabs */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Kategori Iuran
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  {(['', 'Iuran Rutin', 'Iuran Non Rutin'] as const).map((kat) => (
                    <button
                      key={kat || 'ALL'}
                      type="button"
                      onClick={() => {
                        setFilterKategori(kat);
                        const matches = formBayarData.jenis.filter((j) => !kat || j.tipeIuran === kat);
                        if (matches.length > 0) {
                          setSelectedJenis(matches[0].jenis);
                          setNominalNonRutin(matches[0].nominal);
                          setSelectedPeriods(new Set());
                        }
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        filterKategori === kat
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {kat === '' ? 'Semua Kategori' : kat}
                    </button>
                  ))}
                </div>
              </div>

              {filteredJenisOptions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Jenis Iuran *
                    </label>
                    <select
                      value={selectedJenisObj?.jenis || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedJenis(val);
                        const found = formBayarData.jenis.find((j) => j.jenis === val);
                        if (found) setNominalNonRutin(found.nominal);
                        setSelectedPeriods(new Set());
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
                    >
                      {filteredJenisOptions.map((j) => (
                        <option key={j.jenis} value={j.jenis}>
                          [{j.tipeIuran === 'Iuran Non Rutin' ? 'Non Rutin' : 'Rutin'}] {j.jenis} ({formatRupiah(j.nominal)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {currentTipe === 'Iuran Rutin' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Tahun Pembayaran *
                      </label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
                      >
                        {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                          <option key={y} value={y}>
                            Tahun {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nominal Iuran Non Rutin (Rp) *
                      </label>
                      <input
                        type="number"
                        min={1000}
                        step={1000}
                        required
                        value={nominalNonRutin || ''}
                        onChange={(e) => setNominalNonRutin(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-slate-800"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Belum ada tarif aktif untuk kategori <b>{filterKategori}</b>. Atur besarannya di menu <b>Panel Admin &rarr; Pengaturan RT</b> atau <b>Kas & Iuran &rarr; Tarif Iuran</b>.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Belum ada tarif iuran aktif. Pengurus dapat mengatur besar <b>Iuran Rutin</b> & <b>Iuran Non Rutin</b> di menu <b>Panel Admin &rarr; Pengaturan RT</b> atau menambahkan tarif di menu <b>Kas & Iuran &rarr; Tarif Iuran</b>.
              </span>
            </div>
          )
        )}

        {/* Month Chips Selector (Only for Iuran Rutin) */}
        {formBayarData && selectedJenisObj && currentTipe === 'Iuran Rutin' && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Pilih Bulan (Bisa klik beberapa bulan sekaligus) *
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {MS.map((mName, idx) => {
                const per = `${selectedYear}-${pad2(idx + 1)}`;
                const isUsed = usedMap[per];
                const isSelected = selectedPeriods.has(per);

                return (
                  <button
                    key={per}
                    type="button"
                    disabled={Boolean(isUsed)}
                    onClick={() => togglePeriod(per)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                        : isUsed === 'Terverifikasi'
                        ? 'bg-emerald-50 text-emerald-800/60 border-emerald-100 cursor-not-allowed opacity-60'
                        : isUsed === 'Menunggu Verifikasi'
                        ? 'bg-amber-50 text-amber-800/60 border-amber-100 cursor-not-allowed opacity-60'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-medium'
                    }`}
                  >
                    <span className="text-xs block font-semibold">{mName}</span>
                    <span className="text-[10px] block font-mono">
                      {isUsed === 'Terverifikasi'
                        ? 'Lunas'
                        : isUsed === 'Menunggu Verifikasi'
                        ? 'Menunggu'
                        : isSelected
                        ? 'Dipilih'
                        : 'Belum'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Non Rutin Info Box */}
        {formBayarData && selectedJenisObj && currentTipe === 'Iuran Non Rutin' && (
          <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-900">
            <span className="font-bold block mb-0.5">Kategori: Iuran Non Rutin (Insidental)</span>
            <span>Pembayaran bersifat insidental / tidak terikat tagihan bulanan rutin.</span>
          </div>
        )}

        {/* Subtotal calculation box */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs sm:text-sm">
          <div>
            <span className="text-slate-500 block text-xs">Total Pembayaran:</span>
            <span className="font-semibold text-slate-800">
              {currentTipe === 'Iuran Non Rutin'
                ? `${selectedJenisObj?.jenis || 'Iuran Non Rutin'} (1x pembayaran)`
                : `${selectedPeriods.size} bulan × ${formatRupiah(currentJenisNominal)}`}
            </span>
          </div>
          <div className="text-right">
            <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-700 block">
              {formatRupiah(totalBayar)}
            </span>
          </div>
        </div>

        {/* Date and Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tanggal Bayar *
            </label>
            <input
              type="date"
              required
              value={tanggalBayar}
              onChange={(e) => setTanggalBayar(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Metode Pembayaran *
            </label>
            <select
              value={metodeBayar}
              onChange={(e) => setMetodeBayar(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              <option value="Transfer">Transfer Bank</option>
              <option value="QRIS">QRIS / E-Wallet</option>
              <option value="Tunai">Tunai / Cash (Langsung ke Bendahara)</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>
        </div>

        {/* File Upload (Receipt) */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Unggah Bukti Transfer {isWarga ? '*' : '(Opsional untuk Pengurus)'}
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <label className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors">
              <UploadCloud className="w-4 h-4 text-emerald-600" />
              <span>Pilih Foto / Berkas Bukti</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {filePreview && (
              <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Berkas bukti terlampir
              </span>
            )}
          </div>
          {filePreview && filePreview.startsWith('data:image/') && (
            <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-xl max-w-xs">
              <img src={filePreview} alt="Pratinjau bukti" className="max-h-36 rounded-lg mx-auto" />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Catatan Tambahan (Opsional)
          </label>
          <input
            type="text"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Masukkan catatan pembayaran (opsional)..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !selectedJenisObj ||
              (currentTipe === 'Iuran Rutin' && selectedPeriods.size === 0) ||
              (currentTipe === 'Iuran Non Rutin' && (!nominalNonRutin || nominalNonRutin <= 0))
            }
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isSubmitting
              ? 'Menyimpan...'
              : isWarga
              ? 'Kirim Bukti Pembayaran'
              : 'Catat Pembayaran Sekarang'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
