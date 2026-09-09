import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { UploadDocumento } from "./_upload-documento";
import { ExcluirDocumento } from "./_excluir-documento";
import { NotaForm } from "./_nota-form";
import { VisibilidadePortalToggle } from "../_visibilidade-toggle";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

type Props = { params: Promise<{ id: string }> };

export default async function DocumentosClientePage({ params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const [cliente, documentos] = await Promise.all([
    db.cliente.findUnique({ where: { id: clienteId }, select: { portalMostrarDocumentos: true } }),
    db.clienteDocumento.findMany({
      where: { clienteId },
      orderBy: { criadoEm: "desc" },
    }),
  ]);
  if (!cliente) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Documentos</h2>
        <div className="flex items-center gap-3">
          <VisibilidadePortalToggle
            clienteId={clienteId}
            aba="documentos"
            visivelInicial={cliente.portalMostrarDocumentos}
          />
          <NotaForm
            clienteId={clienteId}
            trigger={
              <button
                type="button"
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                + Nova nota
              </button>
            }
          />
          <UploadDocumento clienteId={clienteId} />
        </div>
      </div>

      {documentos.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
          Nenhum documento enviado ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Tamanho</th>
                <th className="px-4 py-3 font-medium">Enviado por</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {documentos.map((doc) => {
                const ehNota = doc.tipo === "nota";
                return (
                  <tr key={doc.id.toString()} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5">
                      {ehNota ? (
                        <NotaForm
                          clienteId={clienteId}
                          nota={{ id: Number(doc.id), nome: doc.nome, conteudo: doc.conteudo ?? "" }}
                          trigger={
                            <div className="cursor-pointer">
                              <span className="font-medium text-neutral-900 hover:underline">
                                📝 {doc.nome}
                              </span>
                              <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-neutral-400">
                                {doc.conteudo}
                              </p>
                            </div>
                          }
                        />
                      ) : (
                        <a
                          href={doc.url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-violet-600 hover:underline"
                        >
                          {doc.nome}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500">{formatBytes(doc.tamanho)}</td>
                    <td className="px-4 py-2.5 text-neutral-500">{doc.enviadoPor ?? "—"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-neutral-400">
                      {fmtDate(doc.criadoEm)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ExcluirDocumento documentoId={Number(doc.id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
