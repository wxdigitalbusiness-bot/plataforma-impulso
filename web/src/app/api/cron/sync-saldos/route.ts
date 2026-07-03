import { NextRequest, NextResponse } from "next/server";
import { sincronizarSaldosTodos } from "@/lib/sync-saldos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resultado = await sincronizarSaldosTodos();
  console.log("[CRON] sync-saldos:", resultado);
  return NextResponse.json(resultado);
}
