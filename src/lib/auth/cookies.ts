export const SESSION_COOKIE_NAME = 'aa_session';

export interface SessionCookie {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  domain: string;
  path: string;
  expires: Date;
}

export function buildSessionCookie(opts: {
  token: string;
  expiresAt: Date;
  production: boolean;
  domain: string;
}): SessionCookie {
  return {
    name: SESSION_COOKIE_NAME,
    value: opts.token,
    httpOnly: true,
    secure: opts.production,
    sameSite: 'lax',
    domain: opts.domain,
    path: '/',
    expires: opts.expiresAt,
  };
}

export function buildClearSessionCookie(opts: {
  production: boolean;
  domain: string;
}): SessionCookie {
  return {
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: opts.production,
    sameSite: 'lax',
    domain: opts.domain,
    path: '/',
    expires: new Date(0),
  };
}
