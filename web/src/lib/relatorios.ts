// Helpers para relatórios públicos compartilháveis:
// - cálculo dos 3 períodos (semanal/quinzenal/mensal)
// - geração de token seguro
//
// Convenção de fuso: todos os cálculos são em BRT (UTC-3) para casar com o ciclo
// do sync n8n (01h BRT). "Hoje" e "ontem" referem-se a BRT.

import { randomBytes } from "node:crypto";

export type TipoRelatorio = "semanal" | "quinzenal" | "mensal";

export type PeriodoRelatorio = {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  label: string;
};

// ─── BRT helpers ──────────────────────────────────────────────────────────────

function nowBRT(): Date {
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}

function fmtISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ontemBRT(): Date {
  const d = nowBRT();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function fmtMesAnoBR(year: number, monthZeroBased: number): string {
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${meses[monthZeroBased]} de ${year}`;
}

function fmtDateBR(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// ─── Período: semanal (últimos 7 dias terminando ontem) ──────────────────────

export function periodoSemanal(): PeriodoRelatorio {
  const to = ontemBRT();
  const from = new Date(to);
  from.setUTCDate(to.getUTCDate() - 6);
  const fromIso = fmtISO(from), toIso = fmtISO(to);
  return {
    from: fromIso,
    to: toIso,
    label: `Semanal — ${fmtDateBR(fromIso)} a ${fmtDateBR(toIso)}`,
  };
}

// ─── Período: quinzenal (últimos 15 dias terminando ontem) ───────────────────

export function periodoQuinzenal(): PeriodoRelatorio {
  const to = ontemBRT();
  const from = new Date(to);
  from.setUTCDate(to.getUTCDate() - 14);
  const fromIso = fmtISO(from), toIso = fmtISO(to);
  return {
    from: fromIso,
    to: toIso,
    label: `Quinzenal — ${fmtDateBR(fromIso)} a ${fmtDateBR(toIso)}`,
  };
}

// ─── Período: mensal (mês calendário escolhido) ──────────────────────────────

/**
 * Mês calendário completo. `mesAno` no formato "YYYY-MM" (ex.: "2026-05").
 * Se omitido, usa o mês passado completo (não o atual, pois ele ainda está em curso).
 */
export function periodoMensal(mesAno?: string): PeriodoRelatorio {
  let year: number, monthZeroBased: number;

  if (mesAno && /^\d{4}-\d{2}$/.test(mesAno)) {
    const [y, m] = mesAno.split("-").map(Number);
    year = y;
    monthZeroBased = m - 1;
  } else {
    // Default: último mês completo. Hoje (BRT) → mês anterior.
    const hoje = nowBRT();
    const ultimoDoMesPassado = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 0));
    year = ultimoDoMesPassado.getUTCFullYear();
    monthZeroBased = ultimoDoMesPassado.getUTCMonth();
  }

  // Primeiro dia do mês
  const first = new Date(Date.UTC(year, monthZeroBased, 1));
  // Último dia do mês (dia 0 do mês seguinte)
  const last = new Date(Date.UTC(year, monthZeroBased + 1, 0));

  const fromIso = fmtISO(first), toIso = fmtISO(last);
  return {
    from: fromIso,
    to: toIso,
    label: `Mensal — ${fmtMesAnoBR(year, monthZeroBased)}`,
  };
}

export function calcularPeriodo(tipo: TipoRelatorio, mesAno?: string): PeriodoRelatorio {
  if (tipo === "semanal")   return periodoSemanal();
  if (tipo === "quinzenal") return periodoQuinzenal();
  return periodoMensal(mesAno);
}

// ─── Geração de token ─────────────────────────────────────────────────────────

/** Token URL-safe de 32 chars (~192 bits de entropia). */
export function gerarToken(): string {
  return randomBytes(24).toString("base64url");
}

// ─── Helpers de exibição ──────────────────────────────────────────────────────

export function formatarPeriodoLabel(tipo: TipoRelatorio, from: string, to: string): string {
  if (tipo === "mensal") {
    const [y, m] = from.split("-").map(Number);
    return `Mensal — ${fmtMesAnoBR(y, m - 1)}`;
  }
  const titulo = tipo === "semanal" ? "Semanal" : "Quinzenal";
  return `${titulo} — ${fmtDateBR(from)} a ${fmtDateBR(to)}`;
}

/** Lista os últimos N meses (mais recente primeiro) como opções "YYYY-MM" + label. */
export function listarMesesRecentes(quantidade = 12): Array<{ value: string; label: string }> {
  const lista: Array<{ value: string; label: string }> = [];
  const hoje = nowBRT();
  let year = hoje.getUTCFullYear();
  let month = hoje.getUTCMonth();
  for (let i = 0; i < quantidade; i++) {
    const value = `${year}-${String(month + 1).padStart(2, "0")}`;
    lista.push({ value, label: fmtMesAnoBR(year, month) });
    month--;
    if (month < 0) { month = 11; year--; }
  }
  return lista;
}

/** Mês atual ainda em curso ("YYYY-MM"). Útil para excluir do select. */
export function mesAtualEmCurso(): string {
  const hoje = nowBRT();
  return `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, "0")}`;
}
