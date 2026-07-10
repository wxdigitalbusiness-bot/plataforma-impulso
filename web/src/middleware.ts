export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Protege tudo exceto auth, _next, arquivos estáticos, relatórios /r/*, páginas QR /qr/* e webhooks externos
    "/((?!api/auth|api/w/|api/whatsapp/qr/|api/webhooks/|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|r/|qr/).*)",
  ],
};
