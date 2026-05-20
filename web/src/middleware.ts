export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Protege tudo exceto API auth, _next, arquivos estáticos e o login
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png).*)",
  ],
};
