export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Protege tudo exceto auth, _next, arquivos estáticos, relatórios /r/*, páginas QR /qr/* e webhooks externos
    // /portal/** tem auth própria via cookie JWT — fica fora do NextAuth
    "/((?!api/auth|api/w/|api/whatsapp/qr/|api/webhooks/|api/crm/|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|r/|qr/|portal).*)",
  ],
};
