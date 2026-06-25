"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Cliente = { id: number; nome: string };

type Props = {
  clientes: Cliente[];
  clienteAtualId: number;
  basePath: string;
};

export function ClienteSeletor({ clientes, clienteAtualId, basePath }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const atual = clientes.find((c) => c.id === clienteAtualId);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors"
      >
        {atual?.nome ?? "Selecionar cliente"}
        <svg className="h-3.5 w-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
          {clientes.map((c) => (
            <button
              key={c.id}
              onClick={() => { router.push(`${basePath}?cliente=${c.id}`); setOpen(false); }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                c.id === clienteAtualId
                  ? "bg-violet-50 font-semibold text-violet-700"
                  : "text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {c.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
