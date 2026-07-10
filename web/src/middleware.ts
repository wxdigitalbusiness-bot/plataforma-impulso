import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyPortalToken, PORTAL_COOKIE } from "@/lib/portal-auth";

export const runtime = "nodejs";

export const config = {
  matcher: [
    "/((?!api/auth|api/w/|api/whatsapp/qr/|api/webhooks/|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|r/|qr/).*)",
  ],
};

export default auth(async (req) => {
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

    if (!req.auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ── Rotas de agência — exige sessão NextAuth ──────────────────────────────
  if (pathname === "/login") {
    return req.auth
      ? NextResponse.redirect(new URL("/", req.url))
      : NextResponse.next();
  }

  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});
