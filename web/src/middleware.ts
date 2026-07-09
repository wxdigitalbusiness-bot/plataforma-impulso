import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { verifyPortalToken, PORTAL_COOKIE } from "@/lib/portal-auth";

export const runtime = "nodejs";

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

  // ── CRM API — aceita sessão de agência OU sessão de portal ───────────────
  if (pathname.startsWith("/api/crm")) {
    // Verifica sessão de portal primeiro (mais específica)
    const portalSession = verifyPortalToken(req.cookies.get(PORTAL_COOKIE)?.value);
    if (portalSession) {
      // Garante que o portal só acessa o próprio clienteId
      const match = pathname.match(/^\/api\/crm\/(\d+)/);
      if (match && parseInt(match[1], 10) !== portalSession.clienteId) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
      return NextResponse.next();
    }

    // Sem sessão de portal: exige sessão de agência
    const agencyToken = await getToken({ req, secret: process.env.AUTH_SECRET });
    if (!agencyToken) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ── Rotas de agência — exige sessão NextAuth ──────────────────────────────
  const agencyToken = await getToken({ req, secret: process.env.AUTH_SECRET });

  if (pathname === "/login") {
    return agencyToken
      ? NextResponse.redirect(new URL("/", req.url))
      : NextResponse.next();
  }

  if (!agencyToken) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|api/w/|api/whatsapp/qr/|api/webhooks/|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|r/|qr/).*)",
  ],
};
