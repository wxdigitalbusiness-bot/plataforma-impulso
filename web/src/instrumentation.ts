export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { default: cron } = await import("node-cron");
  const { sincronizarSaldosTodos } = await import("@/lib/sync-saldos");
  const { sincronizarMetricasGoogle } = await import("@/lib/google-ads-metrics-sync");

  function defaultRange() {
    const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const to = new Date(brt);
    to.setUTCDate(brt.getUTCDate() - 1);
    const from = new Date(to);
    from.setUTCDate(to.getUTCDate() - 6);
    return { from: fmt(from), to: fmt(to) };
  }

  // Saldos: a cada hora, 08h–17h BRT (11h–20h UTC), seg–sex
  cron.schedule("0 11-20 * * 1-5", async () => {
    console.log("[CRON] sync-saldos iniciado");
    const r = await sincronizarSaldosTodos();
    console.log("[CRON] sync-saldos:", r);
  });

  // Métricas Google: 1× por dia às 05h UTC (02h BRT)
  cron.schedule("0 5 * * *", async () => {
    console.log("[CRON] google-metrics iniciado");
    const { from, to } = defaultRange();
    const r = await sincronizarMetricasGoogle(from, to);
    console.log("[CRON] google-metrics:", r);
  });

  console.log("[CRON] agendamentos registrados");
}
