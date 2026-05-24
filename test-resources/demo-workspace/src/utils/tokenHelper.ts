export interface TokenPayload {
  sub: string;
  email: string;
  exp: number;
}

export function parseToken(token: string): TokenPayload {
  const [, payload] = token.split('.');
  return JSON.parse(atob(payload)) as TokenPayload;
}

export function isExpired(token: string): boolean {
  const { exp } = parseToken(token);
  return Date.now() / 1000 > exp;
}
