import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function PortalDocumentosPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const documentos = await db.clienteDocumento.findMany({
    where: { clienteId: session.clienteId },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Documentos</h2>
        <p className="mt-0.5 text-sm text-neutral-500">Arquivos compartilhados pela agência.</p>
      </div>

      {documentos.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
          Nenhum documento disponível ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Tamanho</th>
                <th className="px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {documentos.map((doc) => (
                <tr key={doc.id.toString()} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-violet-600 hover:underline"
                    >
                      {doc.nome}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500">{formatBytes(doc.tamanho)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-neutral-400">
                    {fmtDate(doc.criadoEm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
