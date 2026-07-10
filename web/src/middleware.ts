import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { verifyPortalToken, PORTAL_COOKIE } from "@/lib/portal-auth";

export const runtime = "nodejs";

// NextAuth v5 renomeou o cookie de next-auth.session-token para authjs.session-token
const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

async function agencyToken(req: NextRequest) {
  return getToken({
    req,
    secret: process.env.AUTH_SECRET,
    cookieName: SESSION_COOKIE,
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Portal ────────────────────────────────────────────────────────────────
  if (pathname.startsWith("/portal")) {
    if (pathname === "/portal/login") return NextResponse.next();

    const portalSession = verifyPortalToken(req.cookies.get(PORTAL_COOKIE)?.value);
    if (!portalSession) {
      return NextResponse.redirect(new URL("/portal/login", req.url));
    }
    return NextResponse.next();
  }

  // ── CRM API — aceita sessão de portal OU sessão de agência ───────────────
  if (pathname.startsWith("/api/crm")) {
    const portalSession = verifyPortalToken(req.cookies.get(PORTAL_COOKIE)?.value);
    if (portalSession) {
      const match = pathname.match(/^\/api\/crm\/(\d+)/);
      if (match && parseInt(match[1], 10) !== portalSession.clienteId) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
      return NextResponse.next();
    }

    const token = await agencyToken(req);
    if (!token) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ── Rotas de agência — exige sessão NextAuth ──────────────────────────────
  const token = await agencyToken(req);

  if (pathname === "/login") {
    return token
      ? NextResponse.redirect(new URL("/", req.url))
      : NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|api/w/|api/whatsapp/qr/|api/webhooks/|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|r/|qr/).*)",
  ],
};
