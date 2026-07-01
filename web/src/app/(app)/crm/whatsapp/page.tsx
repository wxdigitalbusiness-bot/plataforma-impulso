import { db } from "@/lib/db";
import { ClienteSeletor } from "@/components/crm/cliente-seletor";
import { LinksWhatsappClient } from "./_links-client";
// ponytail: importa direto de [id]/editar — os componentes são client-side e as actions têm "use server", resolve bem
import { EvolutionWebhookConfig } from "../../clientes/[id]/editar/_evolution-webhook-config";
import { EvolutionCreateInstance } from "../../clientes/[id]/editar/_evolution-create-instance";
import { CrmWebhooksSection, type WebhookExistente } from "../../clientes/[id]/editar/_crm-webhooks-section";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ cliente?: string }> };

type LinkRow = { id: bigint; nome: string; wa_numero: string; mensagem: string; slug: string; ativo: boolean };

export default async function CrmWhatsappPage({ searchParams }: Props) {
  const sp = await searchParams;

  const clientes = await db.cliente.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  if (clientes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-400">
        Nenhum cliente cadastrado.
      </div>
    );
  }

  const clienteId = Number(sp.cliente);
  const clienteValido = clientes.some((c) => c.id === clienteId);

  if (!sp.cliente || !clienteValido) {
    const { redirect } = await import("next/navigation");
    redirect(`/crm/whatsapp?cliente=${clientes[0].id}`);
  }

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    include: {
      crmWebhooks: {
        select: { id: true, etapa: true, etapaLabel: true, ehExtra: true, webhookUrl: true },
        orderBy: [{ ehExtra: "asc" }, { criadoEm: "asc" }],
      },
    },
  });

  if (!cliente) return null;

  const links = await db.$queryRaw<LinkRow[]>`
    SELECT id, nome, wa_numero, mensagem, slug, ativo
    FROM crm_whatsapp_links
    WHERE cliente_id = ${clienteId}
    ORDER BY criado_em ASC
  `;

  const linksSerial = links.map((l) => ({
    id: Number(l.id),
    nome: l.nome,
    wa_numero: l.wa_numero,
    mensagem: l.mensagem,
    slug: l.slug,
    ativo: l.ativo,
  }));

  const webhooks: WebhookExistente[] = cliente.crmWebhooks.map((w) => ({
    id:         Number(w.id),
    etapa:      w.etapa,
    etapaLabel: w.etapaLabel,
    ehExtra:    w.ehExtra,
    webhookUrl: w.webhookUrl,
  }));

  // Pega origin para montar a URL dos links
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">WhatsApp</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Links de redirecionamento, instância e webhooks por cliente.
          </p>
        </div>
        <ClienteSeletor
          clientes={clientes}
          clienteAtualId={clienteId}
          basePath="/crm/whatsapp"
        />
      </div>

      {/* Links de WhatsApp */}
      <section className="space-y-3">
        <LinksWhatsappClient
          clienteId={clienteId}
          links={linksSerial}
          origin={origin}
        />
      </section>

      {/* Instância Evolution */}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-neutral-900">Instância WhatsApp</h2>
          <p className="text-xs text-neutral-500">Conecte o número ao Evolution API para receber mensagens no CRM.</p>
        </div>
        {cliente.evolutionInstance ? (
          <EvolutionWebhookConfig
            clienteId={clienteId}
            instanceName={cliente.evolutionInstance}
            forwardUrl={cliente.n8nWebhookForwardUrl ?? null}
          />
        ) : (
          <EvolutionCreateInstance
            clienteId={clienteId}
            clienteNome={cliente.nome}
          />
        )}
      </section>

      {/* Webhooks CRM */}
      <section className="space-y-3">
        <CrmWebhooksSection
          clienteId={clienteId}
          temClientKey={!!cliente.n8nClientKey?.trim()}
          webhooks={webhooks}
        />
      </section>
    </div>
  );
}
