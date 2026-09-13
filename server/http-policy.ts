import type { CookieOptions, RequestHandler, Response } from 'express';

export function publicOrigin(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.origin !== value) throw Error();
    return url.origin;
  } catch {
    throw new Error('公网地址必须是完整的 HTTPS 来源地址，不含路径、末尾斜杠或账号信息。');
  }
}

// TLS terminates at the gateway. Preserve the public Host; never trust client-supplied
// Forwarded / X-Forwarded-* headers to decide origins, cookies, or authorization.
export function requestPolicy(configuredOrigin?: string): RequestHandler {
  const external = configuredOrigin === undefined ? undefined : publicOrigin(configuredOrigin);
  return (req, res, next) => {
    const origin = external ?? `http://127.0.0.1:${req.socket.localPort}`;
    const crossSite = req.headers['sec-fetch-site'] === 'cross-site';
    const fetchMode = req.headers['sec-fetch-mode'];
    const fetchDestination = req.headers['sec-fetch-dest'];
    const publicEntryNavigation = crossSite &&
      ['GET', 'HEAD'].includes(req.method) &&
      ['/', '/index.html'].includes(req.path) &&
      (fetchMode === undefined || fetchMode === 'navigate') &&
      (fetchDestination === undefined || fetchDestination === 'document');
    res.locals.secureCookies = !!external;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    if (req.headers.host !== new URL(origin).host ||
        (req.headers.origin !== undefined && req.headers.origin !== origin) ||
        (crossSite && !publicEntryNavigation) ||
        (req.path.startsWith('/api/') && !['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin)) {
      res.status(403).json({ error: { errorType: 'ORIGIN_DENIED', message: '请求来源无效，请从拾页页面访问。', retryable: false } });
      return;
    }
    next();
  };
}

export function sessionCookie(res: Response, maxAge?: number): CookieOptions {
  return { httpOnly: true, secure: res.locals.secureCookies === true, sameSite: 'strict', path: '/api', ...(maxAge === undefined ? {} : { maxAge }) };
}
