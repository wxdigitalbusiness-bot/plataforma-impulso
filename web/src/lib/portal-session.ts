import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type PortalSession = {
  portalUserId: number;
  clienteId: number;
  clienteNome: string;
  clientKey: string | null;
  email: string;
  role: string;
};

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET!);
const COOKIE = "portal_session";

export async function createPortalSession(payload: PortalSession) {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as PortalSession;
  } catch {
    return null;
  }
}

export async function deletePortalSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
