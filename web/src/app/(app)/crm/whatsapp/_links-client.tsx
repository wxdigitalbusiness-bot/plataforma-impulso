"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarLink, atualizarLink, alternarAtivo, removerLink } from "./_links-actions";

type Link = { id: number; nome: string; wa_numero: string; mensagem: string; slug: string; ativo: boolean };

type FormState = { nome: string; waNumero: string; mensagem: string };
const FORM_VAZIO: FormState = { nome: "", waNumero: "", mensagem: "" };

function LinkForm({
  initial,
  onSalvar,
  onCancelar,
  pending,
  erro,
}: {
  initial: FormState;
  onSalvar: (s: FormState) => void;
  onCancelar: () => void;
  pending: boolean;
  erro: string | null;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Nome do link</span>
          <input
            value={form.nome}
            onChange={set("nome")}
            placeholder="Ex.: [CRM - Site] Botão do WhatsApp"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Número (DDI+DDD+número)</span>
          <input
            value={form.waNumero}
            onChange={set("waNumero")}
            placeholder="5562999999999"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-600">Mensagem (enviada pelo lead ao clicar)</span>
        <textarea
          value={form.mensagem}
          onChange={set("mensagem") as React.ChangeEventHandler<HTMLTextAreaElement>}
          rows={2}
          placeholder="Ex.: Olá! Vim do site e gostaria de Agendar uma Consulta"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 resize-none"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSalvar(form)}
          disabled={pending || !form.nome.trim() || !form.waNumero.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          {pending ? "Salvando…" : "Salvar link"}
        </button>
      </div>
    </div>
  );
}

export function LinksWhatsappClient({
  clienteId,
  links,
  origin,
}: {
  clienteId: number;
  links: Link[];
  origin: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);

  function copiar(link: Link) {
    const url = `${origin}/api/w/${link.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(link.id);
      setTimeout(() => setCopiado(null), 2000);
    });
  }

  function salvarNovo(form: FormState) {
    setErro(null);
    start(async () => {
      const r = await criarLink(clienteId, form.nome, form.waNumero, form.mensagem);
      if (r.ok) { setCriando(false); router.refresh(); }
      else setErro(r.erro ?? "Erro.");
    });
  }

  function salvarEdicao(id: number, form: FormState) {
    setErro(null);
    start(async () => {
      const r = await atualizarLink(id, form.nome, form.waNumero, form.mensagem);
      if (r.ok) { setEditandoId(null); router.refresh(); }
      else setErro(r.erro ?? "Erro.");
    });
  }

  function toggleAtivo(link: Link) {
    start(async () => {
      await alternarAtivo(link.id, !link.ativo);
      router.refresh();
    });
  }

  function excluir(link: Link) {
    if (!confirm(`Excluir o link "${link.nome}"?`)) return;
    start(async () => {
      await removerLink(link.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-neutral-900">Links de WhatsApp</h2>
          <p className="text-xs text-neutral-500">Cada link redireciona para um número com uma mensagem pré-preenchida.</p>
        </div>
        {!criando && (
          <button
            onClick={() => { setCriando(true); setEditandoId(null); setErro(null); }}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo link
          </button>
        )}
      </div>

      {erro && !criando && !editandoId && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{erro}</p>
      )}

      {/* Form novo */}
      {criando && (
        <LinkForm
          initial={FORM_VAZIO}
          onSalvar={salvarNovo}
          onCancelar={() => { setCriando(false); setErro(null); }}
          pending={pending}
          erro={erro}
        />
      )}

      {/* Tabela de links */}
      {links.length === 0 && !criando ? (
        <p className="text-sm text-neutral-400">Nenhum link cadastrado.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Link</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Número</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {links.map((link) => (
                <tr key={link.id} className="group">
                  {editandoId === link.id ? (
                    <td colSpan={5} className="p-4">
                      <LinkForm
                        initial={{ nome: link.nome, waNumero: link.wa_numero, mensagem: link.mensagem }}
                        onSalvar={(f) => salvarEdicao(link.id, f)}
                        onCancelar={() => { setEditandoId(null); setErro(null); }}
                        pending={pending}
                        erro={erro}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-neutral-800">{link.nome}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="max-w-[220px] truncate text-xs text-neutral-500">
                            {origin}/api/w/{link.slug}
                          </span>
                          <button
                            onClick={() => copiar(link)}
                            title="Copiar link"
                            className="shrink-0 text-neutral-400 hover:text-neutral-700"
                          >
                            {copiado === link.id ? (
                              <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500">+{link.wa_numero}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleAtivo(link)}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            link.ativo
                              ? "bg-green-50 text-green-700 hover:bg-green-100"
                              : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                          }`}
                        >
                          {link.ativo ? "Online" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditandoId(link.id); setCriando(false); setErro(null); }}
                            className="text-xs text-neutral-500 hover:text-neutral-800"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => excluir(link)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
