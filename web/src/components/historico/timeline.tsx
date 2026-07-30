"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HISTORICO_TIPOS, tipoInfo, podeIrProPortal } from "@/lib/historico-tipos";

const TIPOS_FIXOS = new Set(HISTORICO_TIPOS.map((t) => t.valor));

export type Entrada = {
  id: number;
  cliente_id: number;
  cliente_nome: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  data_acao: string;
  autor: string | null;
  visivel_portal: boolean;
};

type Cliente = { id: number; nome: string };
type Props = {
  entradas: Entrada[];
  clientes: Cliente[];
  /** Quando definido, trava o formulário e a lista neste cliente. */
  clienteFixoId?: number;
};

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtData(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Agrupa por mês para dar respiro visual na timeline
function rotuloMes(iso: string) {
  const MESES = ["janeiro","fevereiro","março","abril","maio","junho",
                 "julho","agosto","setembro","outubro","novembro","dezembro"];
  const [y, m] = iso.split("-");
  return `${MESES[Number(m) - 1]} de ${y}`;
}

export function HistoricoTimeline({ entradas, clientes, clienteFixoId }: Props) {
  const router = useRouter();

  const [aberto, setAberto]       = useState(false);
  const [salvando, setSalvando]   = useState(false);
  const [erro, setErro]           = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const [clienteId, setClienteId] = useState<number | "">(clienteFixoId ?? "");
  const [tipo, setTipo]           = useState("criativo");
  const [titulo, setTitulo]       = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataAcao, setDataAcao]   = useState(hojeISO());
  const [visivel, setVisivel]     = useState(true);

  const [filtroTipo, setFiltroTipo]       = useState<string>("todos");
  const [filtroCliente, setFiltroCliente] = useState<number | "todos">("todos");

  // Tipos criados livremente antes, extraídos do próprio histórico — assim
  // viram pills reutilizáveis sem precisar de uma tabela separada
  const tiposCustomUsados = useMemo(() => {
    const vistos = new Set<string>();
    for (const e of entradas) {
      if (!TIPOS_FIXOS.has(e.tipo)) vistos.add(e.tipo);
    }
    return Array.from(vistos).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [entradas]);

  const [novoTipoAberto, setNovoTipoAberto] = useState(false);
  const [novoTipoInput, setNovoTipoInput]   = useState("");
  // Tipo recém-criado nesta sessão, pra aparecer como pill mesmo antes do refresh
  const [tipoRecemCriado, setTipoRecemCriado] = useState<string | null>(null);

  const tiposCustomVisiveis = useMemo(() => {
    const lista = [...tiposCustomUsados];
    if (tipoRecemCriado && !lista.includes(tipoRecemCriado)) lista.push(tipoRecemCriado);
    return lista;
  }, [tiposCustomUsados, tipoRecemCriado]);

  function criarTipoCustom() {
    const nome = novoTipoInput.trim();
    if (!nome) { setNovoTipoAberto(false); return; }
    trocarTipo(nome);
    setTipoRecemCriado(nome);
    setNovoTipoInput("");
    setNovoTipoAberto(false);
  }

  function resetForm() {
    setTipo("criativo");
    setTitulo("");
    setDescricao("");
    setDataAcao(hojeISO());
    setVisivel(true);
    setClienteId(clienteFixoId ?? "");
    setEditandoId(null);
    setErro(null);
  }

  // Trocar de tipo reajusta a visibilidade para o padrão do novo tipo
  function trocarTipo(novo: string) {
    setTipo(novo);
    setVisivel(tipoInfo(novo).portalPadrao);
  }

  function abrirEdicao(e: Entrada) {
    setEditandoId(e.id);
    setClienteId(e.cliente_id);
    setTipo(e.tipo);
    setTitulo(e.titulo);
    setDescricao(e.descricao ?? "");
    setDataAcao(e.data_acao);
    setVisivel(e.visivel_portal);
    setAberto(true);
    setErro(null);
  }

  async function salvar() {
    if (!titulo.trim()) { setErro("Escreva o que foi feito."); return; }
    if (!clienteId)     { setErro("Escolha o cliente."); return; }

    setSalvando(true);
    setErro(null);
    try {
      const url    = editandoId ? `/api/historico/${editandoId}` : "/api/historico";
      const method = editandoId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId, tipo, titulo, descricao, dataAcao, visivelPortal: visivel,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErro(j.erro ?? "Não foi possível salvar.");
        return;
      }
      resetForm();
      setAberto(false);
      router.refresh();
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: number) {
    if (!confirm("Excluir esta entrada do histórico?")) return;
    const res = await fetch(`/api/historico/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  const visiveis = entradas.filter((e) => {
    if (filtroTipo !== "todos" && e.tipo !== filtroTipo) return false;
    if (!clienteFixoId && filtroCliente !== "todos" && e.cliente_id !== filtroCliente) return false;
    return true;
  });

  const podePortal = podeIrProPortal(tipo);

  return (
    <div className="space-y-5">
      {/* ── Formulário ─────────────────────────────────────────────────── */}
      {!aberto ? (
        <button
          onClick={() => { resetForm(); setAberto(true); }}
          className="w-full rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-left text-sm text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
        >
          + Registrar o que foi feito
        </button>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          {/* Tipos como pills — escolha em 1 clique. Fixos + criados livremente antes + criar novo */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {HISTORICO_TIPOS.map((t) => (
              <button
                key={t.valor}
                onClick={() => trocarTipo(t.valor)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  tipo === t.valor ? t.cor : "bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
                }`}
              >
                {t.label}
              </button>
            ))}

            {tiposCustomVisiveis.map((valor) => (
              <button
                key={valor}
                onClick={() => trocarTipo(valor)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  tipo === valor ? tipoInfo(valor).cor : "bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
                }`}
              >
                {valor}
              </button>
            ))}

            {novoTipoAberto ? (
              <input
                autoFocus
                value={novoTipoInput}
                onChange={(e) => setNovoTipoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") criarTipoCustom();
                  if (e.key === "Escape") { setNovoTipoAberto(false); setNovoTipoInput(""); }
                }}
                onBlur={criarTipoCustom}
                placeholder="Nome do tipo..."
                maxLength={40}
                className="w-32 rounded-full border border-neutral-200 px-3 py-1 text-xs outline-none focus:border-neutral-400"
              />
            ) : (
              <button
                onClick={() => setNovoTipoAberto(true)}
                className="rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-400 hover:border-neutral-400 hover:text-neutral-600"
              >
                + Outro
              </button>
            )}
          </div>

          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) salvar(); }}
            placeholder="O que foi feito? Ex: troquei os 3 criativos da campanha de conversão"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />

          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes (opcional) — por que fez, o que esperava"
            rows={2}
            className="mt-2 w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {!clienteFixoId && (
              <select
                value={clienteId}
                onChange={(e) => setClienteId(Number(e.target.value))}
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-neutral-400"
              >
                <option value="">Cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            )}

            <input
              type="date"
              value={dataAcao}
              onChange={(e) => setDataAcao(e.target.value)}
              className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-neutral-400"
            />

            {podePortal ? (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600">
                <input
                  type="checkbox"
                  checked={visivel}
                  onChange={(e) => setVisivel(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-neutral-300"
                />
                Mostrar pro cliente no portal
              </label>
            ) : (
              <span className="text-xs text-neutral-400">
                Tipo interno — nunca aparece no portal
              </span>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => { resetForm(); setAberto(false); }}
                className="rounded-lg px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : editandoId ? "Salvar" : "Registrar"}
              </button>
            </div>
          </div>

          {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
        </div>
      )}

      {/* ── Filtros ────────────────────────────────────────────────────── */}
      {entradas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-neutral-400"
          >
            <option value="todos">Todos os tipos</option>
            {HISTORICO_TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>{t.label}</option>
            ))}
            {tiposCustomUsados.map((valor) => (
              <option key={valor} value={valor}>{valor}</option>
            ))}
          </select>

          {!clienteFixoId && (
            <select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value === "todos" ? "todos" : Number(e.target.value))}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-neutral-400"
            >
              <option value="todos">Todos os clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          )}

          <span className="text-xs text-neutral-400">
            {visiveis.length} {visiveis.length === 1 ? "registro" : "registros"}
          </span>
        </div>
      )}

      {/* ── Timeline ───────────────────────────────────────────────────── */}
      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          {entradas.length === 0
            ? "Nada registrado ainda. O primeiro registro começa o histórico deste cliente."
            : "Nenhum registro com esses filtros."}
        </p>
      ) : (
        <div className="space-y-1">
          {visiveis.map((e, i) => {
            const info = tipoInfo(e.tipo);
            const mesAnterior = i > 0 ? rotuloMes(visiveis[i - 1].data_acao) : null;
            const mes = rotuloMes(e.data_acao);
            const novoMes = mes !== mesAnterior;

            return (
              <div key={e.id}>
                {novoMes && (
                  <p className="px-1 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 first:pt-0">
                    {mes}
                  </p>
                )}
                <div className="group rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${info.cor}`}>
                      {info.label}
                    </span>
                    <span className="text-xs text-neutral-400">{fmtData(e.data_acao)}</span>
                    {!clienteFixoId && (
                      <span className="text-xs font-medium text-neutral-600">{e.cliente_nome}</span>
                    )}
                    {e.autor && <span className="text-xs text-neutral-400">· {e.autor}</span>}
                    {e.visivel_portal && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600">
                        no portal
                      </span>
                    )}

                    <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => abrirEdicao(e)}
                        className="rounded-md px-2 py-1 text-[11px] text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => excluir(e.id)}
                        className="rounded-md px-2 py-1 text-[11px] text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                  <p className="text-sm font-medium text-neutral-900">{e.titulo}</p>
                  {e.descricao && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">
                      {e.descricao}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
