export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const cron = (await import("node-cron")).default;

  function range7d() {
    const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const to = new Date(brt);
    to.setUTCDate(brt.getUTCDate() - 1);
    const from = new Date(to);
    from.setUTCDate(to.getUTCDate() - 6);
    return { from: fmt(from), to: fmt(to) };
  }

  const tz = { timezone: "America/Sao_Paulo" };

  // Saldos Meta + Google: 3× ao dia (8h, 14h, 20h BRT)
  cron.schedule("0 8,14,20 * * *", async () => {
    const { alertarCronQuebrado, alertarFalhasCron } = await import("@/lib/cron-alert");
    try {
      const { sincronizarSaldosTodos } = await import("@/lib/sync-saldos");
      const r = await sincronizarSaldosTodos();
      console.log("[CRON] sync-saldos:", r);
      await alertarFalhasCron("sync-saldos", r);
    } catch (err) {
      console.error("[CRON] sync-saldos erro:", err);
      await alertarCronQuebrado("sync-saldos", err);
    }
  }, tz);

  // Google Ads métricas: todo dia às 6h BRT
  cron.schedule("0 6 * * *", async () => {
    const { alertarCronQuebrado, alertarFalhasCron } = await import("@/lib/cron-alert");
    try {
      const { sincronizarMetricasGoogle } = await import("@/lib/google-ads-metrics-sync");
      const { from, to } = range7d();
      const r = await sincronizarMetricasGoogle(from, to);
      console.log("[CRON] google-metrics:", r);
      await alertarFalhasCron("google-metrics", r);
    } catch (err) {
      console.error("[CRON] google-metrics erro:", err);
      await alertarCronQuebrado("google-metrics", err);
    }
  }, tz);

  // Meta Ads métricas: todo dia às 6h30 BRT
  cron.schedule("30 6 * * *", async () => {
    const { alertarCronQuebrado, alertarFalhasCron } = await import("@/lib/cron-alert");
    try {
      const { sincronizarMetricasMeta } = await import("@/lib/meta-ads-metrics-sync");
      const { from, to } = range7d();
      const r = await sincronizarMetricasMeta(from, to);
      console.log("[CRON] meta-metrics:", r);
      await alertarFalhasCron("meta-metrics", r);
    } catch (err) {
      console.error("[CRON] meta-metrics erro:", err);
      await alertarCronQuebrado("meta-metrics", err);
    }
  }, tz);

  console.log("[CRON] Jobs registrados: sync-saldos (8h/14h/20h), google-metrics (6h), meta-metrics (6h30) — BRT");
}
