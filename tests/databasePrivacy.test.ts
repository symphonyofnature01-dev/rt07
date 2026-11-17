import assert from 'node:assert/strict';
import test from 'node:test';
import { removeNikFromDatabase } from '../src/services/databasePrivacy';
import type { SpreadsheetDatabase } from '../src/types/database';

function database(): SpreadsheetDatabase {
  return {
    Rumah: [], Penduduk: [], Keluarga: [], RiwayatHunian: [], Pembayaran: [], BukuKas: [],
    Tarif: [], Agenda: [], Informasi: [], Pengurus: [], Pengaturan: [], LogAktivitas: [],
  };
}

test('removes legacy NIK without changing other resident data', () => {
  const before = database();
  before.Penduduk = [{
    ID: 'PEN-1', NIK: '3275000000000001', NamaLengkap: 'Ani', JenisKelamin: 'Perempuan',
    TempatLahir: 'Bekasi', TanggalLahir: '2000-01-01', NoHP: '0812', Pekerjaan: 'Guru',
    StatusPenduduk: 'Tetap', StatusData: 'Aktif',
  } as SpreadsheetDatabase['Penduduk'][number] & { NIK: string }];

  const after = removeNikFromDatabase(before);

  assert.deepEqual(after.Penduduk, [{
    ID: 'PEN-1', NamaLengkap: 'Ani', JenisKelamin: 'Perempuan', TempatLahir: 'Bekasi',
    TanggalLahir: '2000-01-01', NoHP: '0812', Pekerjaan: 'Guru', StatusPenduduk: 'Tetap', StatusData: 'Aktif',
  }]);
});
