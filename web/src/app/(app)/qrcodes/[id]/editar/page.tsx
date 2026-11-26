import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { LinkPageForm } from "../../_form";
import { ExcluirBotao } from "./_excluir-botao";
import type { LinkItem } from "../../_actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditarQrCodePage({ params }: Props) {
  const { id } = await params;
  const pageId = Number(id);
  if (Number.isNaN(pageId)) notFound();

  const [page, clientes] = await Promise.all([
    db.linkPage.findUnique({ where: { id: pageId } }),
    db.cliente.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!page) notFound();

  const base = `${process.env.AUTH_URL ?? "http://localhost:3000"}/l`;
  const urlPublica = `${base}/${page.slug}`;
  const qrDataUrl = await QRCode.toDataURL(urlPublica, { width: 480, margin: 2 });

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/qrcodes" className="text-xs text-neutral-500 hover:underline">← QR Codes</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{page.nome}</h1>
        </div>
        <ExcluirBotao id={page.id} />
      </div>

      <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-6 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt={`QR Code de ${page.nome}`} className="h-48 w-48 shrink-0 rounded-lg border border-neutral-100" />
        <div className="flex flex-1 flex-col gap-2 text-center sm:text-left">
          <p className="text-sm text-neutral-600">
            Aponta pra: <a href={urlPublica} target="_blank" rel="noopener noreferrer" className="font-mono text-violet-600 hover:underline">{urlPublica}</a>
          </p>
          <p className="text-xs text-neutral-400">
            Esse link é fixo — editar os links abaixo não muda o QR Code já impresso.
          </p>
          <a
            href={qrDataUrl}
            download={`qrcode-${page.slug}.png`}
            className="mt-1 inline-block w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            ⬇ Baixar PNG
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <LinkPageForm
          clientes={clientes}
          pageBaseUrl={base}
          existente={{
            id: page.id,
            nome: page.nome,
            clienteId: page.clienteId,
            slug: page.slug,
            titulo: page.titulo,
            bio: page.bio,
            fotoUrl: page.fotoUrl,
            links: (page.links as unknown as LinkItem[]) ?? [],
            ativo: page.ativo,
          }}
        />
      </div>
    </div>
  );
}
