"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trocarFotoCliente } from "./_perfil-actions";

type Props = {
  clienteId: number;
  fotoUrl: string | null;
  nome: string;
};

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function FotoPerfil({ clienteId, fotoUrl, nome }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setPreview(URL.createObjectURL(file));

    const fd = new FormData();
    fd.set("foto", file);
    startTransition(async () => {
      const r = await trocarFotoCliente(clienteId, fd);
      if (!r.ok) {
        setErro(r.erro);
        setPreview(null);
      } else {
        router.refresh();
      }
    });
  }

  const imagemAtual = preview ?? fotoUrl;

  return (
    <div className="shrink-0">
      <div className="group relative h-24 w-24 sm:h-28 sm:w-28">
        <div className="h-full w-full overflow-hidden rounded-full border-2 border-white bg-neutral-100 shadow-sm">
          {imagemAtual ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagemAtual} alt={nome} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-neutral-400">
              {iniciais(nome) || "?"}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-center text-[10px] font-medium leading-tight text-transparent transition-colors group-hover:bg-black/40 group-hover:text-white disabled:cursor-wait disabled:bg-black/40 disabled:text-white"
        >
          {pending ? "Enviando..." : "Trocar\nfoto"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="hidden"
        />
      </div>
      {erro && <p className="mt-1 max-w-[7rem] text-[10px] text-red-600">{erro}</p>}
    </div>
  );
}
