import { NextRequest, NextResponse } from "next/server";
import { sincronizarMetricasGoogle } from "@/lib/google-ads-metrics-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function defaultRange() {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const to = new Date(brt);
  to.setUTCDate(brt.getUTCDate() - 1);
  const from = new Date(to);
  from.setUTCDate(to.getUTCDate() - 6);
  return { from: fmt(from), to: fmt(to) };
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const range = defaultRange();
  const from = (body.from as string) || range.from;
  const to   = (body.to   as string) || range.to;

  const resultado = await sincronizarMetricasGoogle(from, to);
  console.log("[CRON] google-metrics:", resultado);
  return NextResponse.json(resultado);
}
