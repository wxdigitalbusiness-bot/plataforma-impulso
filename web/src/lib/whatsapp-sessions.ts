export type QrSession = {
  instanceName: string;
  expiresAt: number;
  lastQr: { base64: string | null; code: string | null };
  status: 'pending' | 'connected';
};

// Persiste entre hot-reloads no dev e entre requests no prod (processo único)
declare global {
  // eslint-disable-next-line no-var
  var __whatsappSessions: Map<string, QrSession> | undefined;
}

export const sessions: Map<string, QrSession> =
  global.__whatsappSessions ?? (global.__whatsappSessions = new Map());

const TTL_MS = (Number(process.env.QR_SESSION_TTL_MINUTES ?? 10)) * 60 * 1000;

export function createSession(instanceName: string, qr: { base64: string | null; code: string | null }): string {
  const { randomUUID } = require('crypto') as typeof import('crypto');
  const token = randomUUID();
  sessions.set(token, {
    instanceName,
    expiresAt: Date.now() + TTL_MS,
    lastQr: qr,
    status: 'pending',
  });
  return token;
}

export function getSession(token: string): QrSession | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

// Limpa expiradas periodicamente
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [token, s] of sessions) {
      if (now > s.expiresAt) sessions.delete(token);
    }
  }, 60_000);
}

export function evoHeaders() {
  return { apikey: process.env.EVOLUTION_API_KEY ?? '' };
}

export const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL ?? '';
