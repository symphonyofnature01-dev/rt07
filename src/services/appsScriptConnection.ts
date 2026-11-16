export interface SpreadsheetConnection {
  spreadsheetTitle: string;
  checkedAt: string;
}

export function normalizeAppsScriptUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Masukkan URL Web App Apps Script yang valid.');
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'script.google.com' ||
    !url.pathname.includes('/macros/s/') ||
    !/\/exec$/.test(url.pathname)
  ) {
    throw new Error('Gunakan URL deployment Apps Script produksi yang berakhir dengan /exec.');
  }

  url.hash = '';
  return url.toString();
}

export async function checkSpreadsheetConnection(webAppUrl: string): Promise<SpreadsheetConnection> {
  const healthUrl = new URL(normalizeAppsScriptUrl(webAppUrl));
  healthUrl.searchParams.set('action', 'health');

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(healthUrl, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Web App merespons HTTP ${response.status}.`);
    }

    let rawPayload: unknown;
    try {
      rawPayload = await response.json();
    } catch {
      throw new Error('Web App tidak mengirim respons JSON. Periksa akses deployment dan URL /exec.');
    }
    if (!rawPayload || typeof rawPayload !== 'object') {
      throw new Error('Web App mengirim respons status yang tidak valid.');
    }

    const payload = rawPayload as { ok?: boolean; spreadsheetTitle?: unknown; checkedAt?: unknown; error?: unknown };
    if (!payload.ok) {
      throw new Error(typeof payload.error === 'string' ? payload.error : 'Web App tidak mengonfirmasi koneksi.');
    }

    return {
      spreadsheetTitle:
        typeof payload.spreadsheetTitle === 'string' && payload.spreadsheetTitle.trim()
          ? payload.spreadsheetTitle
          : 'Spreadsheet RT',
      checkedAt: typeof payload.checkedAt === 'string' ? payload.checkedAt : new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Pemeriksaan koneksi melebihi 8 detik.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
