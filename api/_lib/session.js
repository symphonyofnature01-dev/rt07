import crypto from 'node:crypto';

const COOKIE = 'rt07_session';
const MAX_AGE_SECONDS = 60 * 60 * 8;

function secret() {
  const value = process.env.RT07_SESSION_SECRET;
  if (!value) throw new Error('Variabel Vercel RT07_SESSION_SECRET belum diatur.');
  return value;
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export function setSession(res, session) {
  const payload = base64url(JSON.stringify({ ...session, exp: Date.now() + MAX_AGE_SECONDS * 1000 }));
  res.setHeader('Set-Cookie', `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function getSession(req) {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part.trim(), ''] : [part.slice(0, index).trim(), part.slice(index + 1)];
  }));
  const value = cookies[COOKIE];
  if (!value) return null;
  const [payload, signature] = value.split('.');
  const expected = sign(payload);
  if (!payload || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return decoded.exp > Date.now() ? decoded : null;
  } catch {
    return null;
  }
}
