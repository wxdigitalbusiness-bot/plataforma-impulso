"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRESETS = [
  { label: "3d", dias: 3 },
  { label: "7d", dias: 7 },
  { label: "14d", dias: 14 },
  { label: "30d", dias: 30 },
];

// Formata em horário LOCAL (evita desvio UTC ao usar toISOString)
function fmtLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function calcPreset(dias: number): { from: string; to: string } {
  const hoje = new Date();
  const to = new Date(hoje);
  to.setDate(hoje.getDate() - 1); // ontem LOCAL
  const from = new Date(hoje);
  from.setDate(hoje.getDate() - dias);
  return { from: fmtLocal(from), to: fmtLocal(to) };
}

function isPresetActive(from: string, to: string, dias: number): boolean {
  const p = calcPreset(dias);
  return from === p.from && to === p.to;
}

export function DateFilter({
  from,
  to,
  basePath = "/",
}: {
  from: string;
  to: string;
  basePath?: string;
}) {
  const router = useRouter();
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  const hoje = fmtLocal(new Date());

  function apply(f = localFrom, t = localTo) {
    if (f && t && f <= t) {
      router.push(`${basePath}?from=${f}&to=${t}`);
    }
  }

  function applyPreset(dias: number) {
    const { from: f, to: t } = calcPreset(dias);
    setLocalFrom(f);
    setLocalTo(t);
    apply(f, t);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Presets rápidos */}
      <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1">
        {PRESETS.map(({ label, dias }) => (
          <button
            key={dias}
            onClick={() => applyPreset(dias)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              isPresetActive(from, to, dias)
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Separador */}
      <span className="text-xs text-neutral-300">|</span>

      {/* Inputs de data */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={localFrom}
          max={localTo}
          onChange={(e) => setLocalFrom(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none"
        />
        <span className="text-xs text-neutral-400">até</span>
        <input
          type="date"
          value={localTo}
          min={localFrom}
          max={hoje}
          onChange={(e) => setLocalTo(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none"
        />
      </div>

      <button
        onClick={() => apply()}
        disabled={!localFrom || !localTo || localFrom > localTo}
        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Aplicar
      </button>
    </div>
  );
}
