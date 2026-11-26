"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarLinkPage, atualizarLinkPage, uploadFotoLinkPage, type LinkItem } from "./_actions";

type Cliente = { id: number; nome: string };

type Props = {
  clientes: Cliente[];
  pageBaseUrl: string;
  existente?: {
    id: number;
    nome: string;
    clienteId: number | null;
    slug: string;
    titulo: string | null;
    bio: string | null;
    fotoUrl: string | null;
    corFundo: string | null;
    links: LinkItem[];
    ativo: boolean;
  };
};

const COR_FUNDO_PADRAO = "#fafafa";

export function LinkPageForm({ clientes, pageBaseUrl, existente }: Props) {
  const router = useRouter();
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState(existente?.nome ?? "");
  const [clienteId, setClienteId] = useState<number | null>(existente?.clienteId ?? null);
  const [slugCustom, setSlugCustom] = useState("");
  const [titulo, setTitulo] = useState(existente?.titulo ?? "");
  const [bio, setBio] = useState(existente?.bio ?? "");
  const [fotoUrl, setFotoUrl] = useState(existente?.fotoUrl ?? "");
  const [corFundo, setCorFundo] = useState(existente?.corFundo ?? COR_FUNDO_PADRAO);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkItem[]>(
    existente?.links.length ? existente.links : [{ label: "", url: "", ativo: true }],
  );
  const [ativo, setAtivo] = useState(existente?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErroFoto(null);
    setEnviandoFoto(true);
    const fd = new FormData();
    fd.set("foto", file);
    uploadFotoLinkPage(fd).then((r) => {
      setEnviandoFoto(false);
      if (!r.ok) { setErroFoto(r.erro); return; }
      setFotoUrl(r.url);
    });
  }

  function atualizarLink(i: number, campo: keyof LinkItem, valor: string | boolean) {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }
  function removerLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }
  function moverLink(i: number, dir: -1 | 1) {
    setLinks((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const payloadComum = { nome, clienteId, titulo, bio, fotoUrl, corFundo, links };
      if (existente) {
        const r = await atualizarLinkPage(existente.id, { ...payloadComum, ativo });
        if (!r.ok) { setErro(r.erro); return; }
        router.push(`/qrcodes/${existente.id}/editar`);
      } else {
        const r = await criarLinkPage({ ...payloadComum, slugCustom });
        if (!r.ok) { setErro(r.erro); return; }
        router.push(`/qrcodes/${r.id}/editar`);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Nome (rótulo interno) *</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Plaquinha mesa — Caldeiras Santesso"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Cliente vinculado (opcional)</span>
          <select
            value={clienteId ?? ""}
            onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          >
            <option value="">— sem vínculo —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>
      </div>

      {existente ? (
        <div className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          Link público: <span className="font-mono text-neutral-700">{pageBaseUrl}/{existente.slug}</span>
          <span className="ml-2 text-neutral-400">(fixo — é o que vai impresso na plaquinha/NFC)</span>
        </div>
      ) : (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Link personalizado (opcional)</span>
          <div className="flex items-center gap-1 text-sm text-neutral-500">
            <span className="shrink-0 font-mono text-xs text-neutral-400">{pageBaseUrl}/</span>
            <input
              value={slugCustom}
              onChange={(e) => setSlugCustom(e.target.value)}
              placeholder="caldeiras-santesso (deixe em branco pra gerar automático)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
            />
          </div>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Título exibido na página</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Caldeiras Santesso"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          />
        </label>
        <div>
          <span className="mb-1 block text-xs font-medium text-neutral-700">Foto</span>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
              {fotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fotoInputRef.current?.click()}
              disabled={enviandoFoto}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              {enviandoFoto ? "Enviando..." : fotoUrl ? "Trocar imagem" : "Escolher imagem"}
            </button>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              onChange={onFotoChange}
              className="hidden"
            />
          </div>
          {erroFoto && <p className="mt-1 text-xs text-red-600">{erroFoto}</p>}
        </div>
      </div>

      <label className="block w-fit">
        <span className="mb-1 block text-xs font-medium text-neutral-700">Cor de fundo da página</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={corFundo}
            onChange={(e) => setCorFundo(e.target.value)}
            className="h-9 w-14 cursor-pointer rounded border border-neutral-300 p-0.5"
          />
          <span className="font-mono text-xs text-neutral-400">{corFundo}</span>
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-700">Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={2}
          placeholder="Frase curta sobre o negócio"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
      </label>

      <div>
        <span className="mb-2 block text-xs font-medium text-neutral-700">Links da página</span>
        <div className="space-y-2">
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-2">
              <div className="flex flex-col gap-0.5">
                <button type="button" onClick={() => moverLink(i, -1)} disabled={i === 0} className="text-neutral-400 hover:text-neutral-700 disabled:opacity-20">▲</button>
                <button type="button" onClick={() => moverLink(i, 1)} disabled={i === links.length - 1} className="text-neutral-400 hover:text-neutral-700 disabled:opacity-20">▼</button>
              </div>
              <input
                value={link.label}
                onChange={(e) => atualizarLink(i, "label", e.target.value)}
                placeholder="Rótulo (ex.: Cardápio, Instagram, WhatsApp)"
                className="flex-1 min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
              />
              <input
                value={link.url}
                onChange={(e) => atualizarLink(i, "url", e.target.value)}
                placeholder="https://..."
                className="flex-[1.5] min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
              />
              <label className="flex shrink-0 items-center gap-1 text-xs text-neutral-500">
                <input type="checkbox" checked={link.ativo} onChange={(e) => atualizarLink(i, "ativo", e.target.checked)} />
                Ativo
              </label>
              <button type="button" onClick={() => removerLink(i)} className="shrink-0 text-xs text-red-500 hover:text-red-700">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLinks((prev) => [...prev, { label: "", url: "", ativo: true }])}
          className="mt-2 text-xs font-medium text-violet-600 hover:underline"
        >
          + Adicionar link
        </button>
      </div>

      {existente && (
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Página ativa (desmarque pra desativar sem apagar)
        </label>
      )}

      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/qrcodes")}
          className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={pending || !nome.trim()}
          className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {pending ? "Salvando..." : existente ? "Salvar alterações" : "Criar QR Code"}
        </button>
      </div>
    </div>
  );
}
