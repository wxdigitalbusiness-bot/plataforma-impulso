import crypto from "node:crypto";
import { cookies } from "next/headers";

const SECRET = process.env.PORTAL_SESSION_SECRET ?? process.env.AUTH_SECRET ?? "portal-dev-secret";
export const PORTAL_COOKIE = "portal-session";
// 30 dias em segundos
const MAX_AGE = 60 * 60 * 24 * 30;

export type PortalSession = {
  usuarioId: number;
  clienteId: number;
  role: "admin" | "operador" | "visualizador";
  nome: string;
  clienteNome: string;
};

export function signPortalToken(payload: PortalSession): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyPortalToken(token: string | undefined): PortalSession | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const expected = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
    // timingSafeEqual requer buffers do mesmo tamanho
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(data, "base64url").toString()) as PortalSession;
  } catch {
    return null;
  }
}

// Lê sessão do cookie em server components / actions
export async function getPortalSession(): Promise<PortalSession | null> {
  const jar = await cookies();
  return verifyPortalToken(jar.get(PORTAL_COOKIE)?.value);
}

export function portalCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}
