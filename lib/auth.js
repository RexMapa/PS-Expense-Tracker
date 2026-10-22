import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
const cookieName = 'primesphere_session';
const lifetime = 60 * 60 * 24 * 7;
export function configured(env) {
  return typeof env.APP_PASSWORD === 'string' && env.APP_PASSWORD.length >= 16 && typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 32;
}
function signature(value, env) {
  return createHmac('sha256', env.SESSION_SECRET).update(`${env.APP_PASSWORD}:${value}`).digest('hex');
}
function equal(a, b) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
export function validPassword(password, env) {
  return typeof password === 'string' && password.length <= 1024 && equal(password, env.APP_PASSWORD);
}
export function sessionCookie(env, secure = true, now = Date.now()) {
  const expires = String(Math.floor(now / 1000) + lifetime);
  return `${cookieName}=${expires}.${signature(expires, env)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${lifetime}${secure ? '; Secure' : ''}`;
}
export function clearCookie(secure = true) {
  return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}
export function authenticated(req, env, now = Date.now()) {
  const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='));
  if (!cookie) return false;
  const [expires, sig, extra] = cookie.slice(cookieName.length + 1).split('.');
  return !extra && /^\d+$/.test(expires || '') && Number(expires) > Math.floor(now / 1000) && Number(expires) <= Math.floor(now / 1000) + lifetime && /^[a-f0-9]{64}$/.test(sig || '') && equal(signature(expires, env), sig);
}
