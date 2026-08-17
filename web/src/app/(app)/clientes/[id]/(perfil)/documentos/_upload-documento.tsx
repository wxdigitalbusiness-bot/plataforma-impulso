"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enviarDocumento } from "./_documento-actions";

export function UploadDocumento({ clienteId }: { clienteId: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);

    const fd = new FormData();
    fd.set("arquivo", file);
    startTransition(async () => {
      const r = await enviarDocumento(clienteId, fd);
      if (!r.ok) {
        setErro(r.erro);
      } else {
        router.refresh();
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Enviando..." : "+ Enviar arquivo"}
      </button>
      <input ref={inputRef} type="file" onChange={onFileChange} className="hidden" />
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
    </div>
  );
}
