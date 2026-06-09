"use client";

import { useState, useTransition } from "react";
import {
  configurarCrmWebhooks,
  excluirCrmWebhooks,
  adicionarEtapaExtra,
  removerEtapaWebhook,
  regenerarWebhooksBase,
} from "./_crm-webhook-actions";
import { LABEL_ETAPA } from "@/lib/crm-webhook-template";

export type WebhookExistente = {
  id: number;
  etapa: string;
  etapaLabel: string;
  ehExtra: boolean;
  webhookUrl: string;
};

type Props = {
  clienteId: number;
  temClientKey: boolean;
  webhooks: WebhookExistente[];
};

// Ordem visual: 5 base na ordem fixa, depois extras (mais novas embaixo)
const ORDEM_BASE = ["novo_lead", "nao_classificado", "qualificado", "perdido", "concluido"];

export function CrmWebhooksSection({ clienteId, temClientKey, webhooks }: Props) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [novaEtapaLabel, setNovaEtapaLabel] = useState("");
  const [mostrandoForm, setMostrandoForm] = useState(false);

  const temBase   = webhooks.some((w) => !w.ehExtra);
  const baseRows  = ORDEM_BASE
    .map((etapaSlug) => webhooks.find((w) => w.etapa === etapaSlug))
    .filter((w): w is WebhookExistente => !!w);
  const extras    = webhooks.filter((w) => w.ehExtra);
  const temAlgum  = webhooks.length > 0;

  function gerarBase() {
    setErro(null); setOkMsg(null);
    startTransition(async () => {
      const r = await configurarCrmWebhooks({ clienteId });
      if (r.ok) setOkMsg(`${r.criados} workflows base criados no n8n. Copie as URLs abaixo.`);
      else setErro(r.erro);
    });
  }

  function regenerarBase() {
    setErro(null); setOkMsg(null);
    startTransition(async () => {
      const r = await regenerarWebhooksBase({ clienteId });
      if (r.ok) setOkMsg(`${r.criados} workflows base regenerados com o SQL atualizado. URLs mantidas.`);
      else setErro(r.erro);
    });
  }

  function excluirTudo() {
    if (!confirm("Apagar TODOS os webhooks (base + extras) deste cliente? Os workflows serão removidos do n8n.")) return;
    setErro(null); setOkMsg(null);
    startTransition(async () => {
      const r = await excluirCrmWebhooks({ clienteId });
      if (r.ok) setOkMsg(`${r.deletados} webhooks excluídos.`);
      else setErro(r.erro);
    });
  }

  function adicionarExtra() {
    const label = novaEtapaLabel.trim();
    if (!label) { setErro("Digite o nome da etapa."); return; }
    setErro(null); setOkMsg(null);
    startTransition(async () => {
      const r = await adicionarEtapaExtra({ clienteId, label });
      if (r.ok) {
        setOkMsg(`Etapa "${label}" adicionada. Copie a URL e configure no CRM.`);
        setNovaEtapaLabel("");
        setMostrandoForm(false);
      } else {
        setErro(r.erro);
      }
    });
  }

  function removerUma(id: number, label: string) {
    if (!confirm(`Remover a etapa "${label}"? O workflow será apagado do n8n.`)) return;
    setErro(null); setOkMsg(null);
    startTransition(async () => {
      const r = await removerEtapaWebhook({ webhookId: id });
      if (r.ok) setOkMsg(`Etapa "${label}" removida.`);
      else setErro(r.erro);
    });
  }

  async function copiar(id: number, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 2000);
    } catch { /* ignore */ }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Integração CRM</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            A plataforma cria workflows no n8n e gera os webhook URLs. Cole cada URL na automação correspondente do seu CRM externo.
          </p>
        </div>
        <div className="flex gap-2">
          {!temBase && (
            <button
              type="button"
              onClick={gerarBase}
              disabled={pending || !temClientKey}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              title={!temClientKey ? "Preencha n8n_client_key antes." : "Cria os 5 webhooks base"}
            >
              {pending ? "Gerando..." : "⚙ Gerar webhooks base"}
            </button>
          )}
          {temBase && (
            <button
              type="button"
              onClick={regenerarBase}
              disabled={pending}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
              title="Recria os 5 workflows base com o SQL mais recente. URLs não mudam. Etapas extras são preservadas."
            >
              {pending ? "Regenerando..." : "↺ Regenerar base"}
            </button>
          )}
          {temAlgum && (
            <button
              type="button"
              onClick={excluirTudo}
              disabled={pending}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              Excluir todos
            </button>
          )}
        </div>
      </div>

      {!temClientKey && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠ Preencha <strong>n8n_client_key</strong> no formulário acima e salve antes.
        </p>
      )}
      {erro && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
      )}
      {okMsg && (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{okMsg}</p>
      )}

      {temAlgum ? (
        <div className="space-y-2">
          {/* 5 etapas base */}
          {baseRows.map((w) => (
            <WebhookRow
              key={w.id}
              label={LABEL_ETAPA[w.etapa as keyof typeof LABEL_ETAPA] ?? w.etapaLabel}
              url={w.webhookUrl}
              isCopied={copiado === w.id}
              onCopy={() => copiar(w.id, w.webhookUrl)}
            />
          ))}

          {/* Etapas extras */}
          {extras.length > 0 && (
            <>
              <p className="mt-4 mb-1 text-[11px] uppercase tracking-wider text-neutral-500">
                Etapas extras deste cliente
              </p>
              {extras.map((w) => (
                <WebhookRow
                  key={w.id}
                  label={w.etapaLabel}
                  url={w.webhookUrl}
                  isCopied={copiado === w.id}
                  onCopy={() => copiar(w.id, w.webhookUrl)}
                  onRemove={() => removerUma(w.id, w.etapaLabel)}
                />
              ))}
            </>
          )}

          {/* Form pra adicionar nova etapa extra */}
          <div className="mt-4 border-t border-neutral-100 pt-4">
            {mostrandoForm ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={novaEtapaLabel}
                  onChange={(e) => setNovaEtapaLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") adicionarExtra(); }}
                  placeholder='Nome da etapa (ex: "Em negociação")'
                  autoFocus
                  className="flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={adicionarExtra}
                  disabled={pending || !novaEtapaLabel.trim()}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
                >
                  {pending ? "Criando..." : "Adicionar"}
                </button>
                <button
                  type="button"
                  onClick={() => { setMostrandoForm(false); setNovaEtapaLabel(""); }}
                  className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMostrandoForm(true)}
                className="text-xs font-medium text-neutral-700 hover:text-neutral-900"
              >
                + Adicionar etapa extra
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-6 text-center">
          <p className="text-xs text-neutral-500">
            Nenhum webhook configurado ainda. Clique em <strong>Gerar webhooks base</strong> pra
            criar 5 endpoints (um por etapa-padrão) automaticamente no n8n.
          </p>
        </div>
      )}
    </section>
  );
}

// ─── Sub-componente: linha de webhook ────────────────────────────────────────

function WebhookRow({
  label, url, isCopied, onCopy, onRemove,
}: {
  label: string;
  url: string;
  isCopied: boolean;
  onCopy: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-44 shrink-0 text-xs font-medium text-neutral-700">{label}</span>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none"
      />
      <button
        type="button"
        onClick={onCopy}
        className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
      >
        {isCopied ? "✓ Copiado" : "Copiar"}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          title="Remove esta etapa (apaga workflow do n8n)"
        >
          Remover
        </button>
      )}
    </div>
  );
}
