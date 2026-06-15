export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Protege tudo exceto auth, _next, arquivos estáticos, relatórios /r/*, páginas QR /qr/* e API pública de polling
    "/((?!api/auth|api/whatsapp/qr/|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|r/|qr/).*)",
  ],
};
