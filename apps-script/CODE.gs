/**
 * Tempelkan script ini pada Google Apps Script yang terikat ke Spreadsheet RT.
 * Jalankan setupSpreadsheetConnection sekali, lalu deploy sebagai Web App.
 */
function setupSpreadsheetConnection() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());
}

function doGet(event) {
  // shortcut: health-only endpoint, add authenticated writes only when data sync is required.
  if (!event || !event.parameter || event.parameter.action !== 'health') {
    return json_({ ok: false, error: 'Aksi tidak dikenal.' });
  }

  try {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!spreadsheetId) {
      return json_({ ok: false, error: 'Jalankan setupSpreadsheetConnection terlebih dahulu.' });
    }

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    return json_({
      ok: true,
      spreadsheetTitle: spreadsheet.getName(),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: 'Spreadsheet tidak dapat diakses oleh Web App.' });
  }
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
