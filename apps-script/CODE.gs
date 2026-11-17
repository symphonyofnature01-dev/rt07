/**
 * RT 07 GO DIGITAL - Google Sheets database bridge.
 * The browser never calls read/write directly. Vercel calls this Web App with
 * the token stored in Script Properties, so the token is not exposed to users.
 */
var SHEET_SCHEMA = {
  Rumah: ['ID', 'Blok', 'Nomor', 'Alamat', 'StatusHunian', 'IDPemilik', 'IDPenanggungJawabIuran', 'PihakPembayarIuran', 'KategoriIuran', 'Catatan', 'PINHash'],
  Penduduk: ['ID', 'NIK', 'NamaLengkap', 'JenisKelamin', 'TempatLahir', 'TanggalLahir', 'NoHP', 'Pekerjaan', 'StatusPenduduk', 'StatusData'],
  Keluarga: ['ID', 'IDRumah', 'IDPenduduk', 'IDKepalaKeluarga', 'HubunganKeluarga', 'Peran', 'StatusMenghuni'],
  RiwayatHunian: ['ID', 'IDRumah', 'IDKepalaKeluarga', 'NamaKeluarga', 'JenisHunian', 'TanggalMulai', 'TanggalSelesai', 'StatusHunian', 'Catatan'],
  Pembayaran: ['ID', 'AlamatRumah', 'JenisIuran', 'TipeIuran', 'Periode', 'Tahun', 'Bulan', 'Nominal', 'TanggalBayar', 'MetodeBayar', 'BuktiURL', 'KodeTransaksi', 'Status', 'PihakPembayar', 'CatatanVerifikator', 'DiverifikasiOleh', 'TanggalVerifikasi'],
  BukuKas: ['ID', 'Tanggal', 'Jenis', 'Kategori', 'Uraian', 'Nominal', 'SumberReferensi', 'DicatatOleh'],
  Tarif: ['ID', 'JenisIuran', 'TipeIuran', 'KategoriIuran', 'Nominal', 'Status'],
  Agenda: ['ID', 'Judul', 'Tanggal', 'Waktu', 'Lokasi', 'Deskripsi', 'Status', 'DibuatOleh'],
  Informasi: ['ID', 'Judul', 'Isi', 'Kategori', 'TanggalTerbit', 'Status', 'DibuatOleh'],
  Pengurus: ['ID', 'Nama', 'Username', 'PasswordHash', 'Jabatan', 'Role', 'Status', 'DibuatPada'],
  Pengaturan: ['Kunci', 'Nilai'], LogAktivitas: ['Waktu', 'User', 'Aksi', 'Detail']
};
var NUMERIC_COLUMNS = { Tahun: true, Bulan: true, Nominal: true };

function setupSpreadsheetDatabase() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());
  ensureSheets_(spreadsheet);
}

// Run once only when the spreadsheet is new. It never overwrites existing rows.
function initializeDatabase() {
  setupSpreadsheetDatabase();
  var spreadsheet = getSpreadsheet_();
  var pengurus = spreadsheet.getSheetByName('Pengurus');
  var initialPassword = '';
  if (pengurus.getLastRow() <= 1) {
    initialPassword = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    pengurus.appendRow(['PGR-001', 'Administrator RT', 'admin', passwordHash_(initialPassword, Utilities.getUuid().replace(/-/g, '')), 'Administrator Sistem', 'Admin', 'Aktif', now_()]);
  }
  var settings = spreadsheet.getSheetByName('Pengaturan');
  if (settings.getLastRow() <= 1) {
    settings.getRange(2, 1, 11, 2).setValues([
      ['NamaAplikasi', 'RT 07 GO DIGITAL'], ['NamaRT', 'RT 07'], ['AlamatRT', 'Bintang Metropol'],
      ['PinWargaAktif', 'TIDAK'], ['RekeningBank', ''], ['RekeningNomor', ''], ['RekeningAtasNama', ''],
      ['MulaiIuran', '2026-01'], ['NominalIuranRutin', '0'], ['NominalIuranNonRutin', '0'], ['WajibGantiPassword', 'PGR-001']
    ]);
  }
  if (initialPassword) console.log('Password awal admin (ganti segera setelah login): ' + initialPassword);
}

function setBridgeToken() {
  // Copy the logged token exactly once into Vercel as APPS_SCRIPT_DATABASE_TOKEN.
  var token = Utilities.getUuid() + Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('BRIDGE_TOKEN', token);
  console.log(token);
}

function doGet(event) {
  if (!event || !event.parameter || event.parameter.action !== 'health') return json_({ ok: false, error: 'Aksi tidak dikenal.' });
  try {
    var spreadsheet = getSpreadsheet_();
    return json_({ ok: true, spreadsheetTitle: spreadsheet.getName(), checkedAt: new Date().toISOString() });
  } catch (error) {
    return json_({ ok: false, error: 'Spreadsheet tidak dapat diakses oleh Web App.' });
  }
}

function doPost(event) {
  try {
    if (!event || !event.parameter || event.parameter.token !== PropertiesService.getScriptProperties().getProperty('BRIDGE_TOKEN')) return json_({ ok: false, error: 'Akses database ditolak.' });
    var body = JSON.parse((event.postData && event.postData.contents) || '{}');
    if (body.action === 'read') return json_({ ok: true, database: readDatabase_(), revision: revision_() });
    if (body.action === 'patch') return json_(applyPatch_(body.changes || [], body.expectedRevision));
    return json_({ ok: false, error: 'Aksi database tidak dikenal.' });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: error.message || String(error) });
  }
}

// Manual edits in Google Sheets invalidate stale browser snapshots too.
function onEdit(event) {
  incrementRevision_();
}

function ensureSheets_(spreadsheet) {
  Object.keys(SHEET_SCHEMA).forEach(function (name) {
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, SHEET_SCHEMA[name].length).setValues([SHEET_SCHEMA[name]]);
      sheet.setFrozenRows(1);
    }
  });
}

function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Jalankan setupSpreadsheetDatabase terlebih dahulu.');
  return SpreadsheetApp.openById(id);
}

function readDatabase_() {
  var spreadsheet = getSpreadsheet_();
  ensureSheets_(spreadsheet);
  var database = {};
  Object.keys(SHEET_SCHEMA).forEach(function (name) {
    var sheet = spreadsheet.getSheetByName(name);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { database[name] = []; return; }
    var values = sheet.getRange(1, 1, lastRow, SHEET_SCHEMA[name].length).getDisplayValues();
    var headers = values[0];
    database[name] = values.slice(1).filter(function (row) { return row.some(function (cell) { return String(cell).trim() !== ''; }); }).map(function (row) {
      var result = {};
      headers.forEach(function (header, index) {
        if (!header) return;
        result[header] = NUMERIC_COLUMNS[header] ? Number(String(row[index] || '0').replace(/[^0-9.-]/g, '')) || 0 : String(row[index] || '');
      });
      return result;
    });
  });
  return database;
}

function rowKey_(sheetName, row) {
  if (sheetName === 'Pengaturan') return String(row.Kunci || '');
  if (sheetName === 'LogAktivitas') return [row.Waktu, row.User, row.Aksi, row.Detail].map(String).join('\u001f');
  return String(row.ID || '');
}

function applyPatch_(changes, expectedRevision) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var spreadsheet = getSpreadsheet_();
    ensureSheets_(spreadsheet);
    if (Number(expectedRevision) !== revision_()) throw new Error('CONFLICT: data telah berubah.');
    changes.forEach(function (change) {
      if (!SHEET_SCHEMA[change.sheet]) throw new Error('Sheet tidak valid.');
      applySheetPatch_(spreadsheet.getSheetByName(change.sheet), change.sheet, change);
    });
    return { ok: true, revision: incrementRevision_() };
  } finally { lock.releaseLock(); }
}

function applySheetPatch_(sheet, sheetName, change) {
  var headers = SHEET_SCHEMA[sheetName];
  var lastRow = sheet.getLastRow();
  var values = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues() : [];
  var rowIndexByKey = {};
  values.forEach(function (row, index) {
    var object = {};
    headers.forEach(function (header, column) { object[header] = row[column]; });
    rowIndexByKey[rowKey_(sheetName, object)] = index + 2;
  });
  (change.upserts || []).forEach(function (row) {
    var key = rowKey_(sheetName, row);
    if (!key) throw new Error('Kunci data tidak valid.');
    var output = headers.map(function (header) { return row[header] === undefined || row[header] === null ? '' : row[header]; });
    if (rowIndexByKey[key]) sheet.getRange(rowIndexByKey[key], 1, 1, headers.length).setValues([output]);
    else sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([output]);
  });
  var deletes = (change.deletes || []).map(function (key) { return rowIndexByKey[key]; }).filter(Boolean).sort(function (a, b) { return b - a; });
  deletes.forEach(function (rowIndex) { sheet.deleteRow(rowIndex); });
}

function passwordHash_(password, salt) {
  var hash = 0;
  var source = salt + password;
  for (var i = 0; i < source.length; i++) hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  return salt + '$' + Math.abs(hash).toString(16);
}

function revision_() { return Number(PropertiesService.getScriptProperties().getProperty('DATABASE_REVISION') || '0'); }
function incrementRevision_() {
  var next = revision_() + 1;
  PropertiesService.getScriptProperties().setProperty('DATABASE_REVISION', String(next));
  return next;
}

function now_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'); }
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
