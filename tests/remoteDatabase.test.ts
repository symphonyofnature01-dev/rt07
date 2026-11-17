import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabasePatch } from '../src/services/remoteDatabase';
import type { SpreadsheetDatabase } from '../src/types/database';

function database(): SpreadsheetDatabase {
  return {
    Rumah: [], Penduduk: [], Keluarga: [], RiwayatHunian: [], Pembayaran: [], BukuKas: [],
    Tarif: [], Agenda: [], Informasi: [], Pengurus: [], Pengaturan: [], LogAktivitas: [],
  };
}

test('creates row-level upserts and deletes without touching unchanged sheets', () => {
  const before = database();
  before.Rumah = [{ ID: 'RMH-1', Blok: 'A', Nomor: '1', Alamat: 'A/1', StatusHunian: 'Kosong', PihakPembayarIuran: 'Pemilik', KategoriIuran: 'Umum', Catatan: '', PINHash: '' }];
  const after = database();
  after.Rumah = [{ ...before.Rumah[0], StatusHunian: 'Dihuni Pemilik' }];
  after.Penduduk = [{ ID: 'PEN-1', NIK: '1', NamaLengkap: 'Ani', JenisKelamin: 'Perempuan', TempatLahir: '', TanggalLahir: '', NoHP: '', Pekerjaan: '', StatusPenduduk: 'Tetap', StatusData: 'Aktif' }];

  const patch = createDatabasePatch(before, after);
  assert.deepEqual(patch.changes.map((change) => change.sheet), ['Rumah', 'Penduduk']);
  assert.equal(patch.changes[0].upserts[0].StatusHunian, 'Dihuni Pemilik');
  assert.equal(patch.changes[1].upserts[0].ID, 'PEN-1');
});

test('uses Pengaturan key and emits a delete only for a missing row', () => {
  const before = database();
  before.Pengaturan = [{ Kunci: 'NamaRT', Nilai: 'RT 07' }];
  const after = database();
  const patch = createDatabasePatch(before, after);
  assert.deepEqual(patch.changes, [{ sheet: 'Pengaturan', upserts: [], deletes: ['NamaRT'] }]);
});
