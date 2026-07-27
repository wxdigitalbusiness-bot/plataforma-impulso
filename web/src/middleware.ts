import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/w/",
  "/api/whatsapp/qr/",
  "/api/webhooks/",
  "/api/crm/",
  "/api/cron/",
  "/_next/static",
  "/_next/image",
  "/r/",
  "/qr/",
  "/portal",
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }
  return (auth as (req: NextRequest) => Response | Promise<Response>)(req);
}

export const config = {
  matcher: ["/((?!favicon.ico|.*\\.svg|.*\\.png).*)"],
};
