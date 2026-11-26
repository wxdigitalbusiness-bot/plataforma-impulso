import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function pageBaseUrl(): string {
  return `${process.env.AUTH_URL ?? "http://localhost:3000"}/l`;
}

export default async function QrCodesPage() {
  const pages = await db.linkPage.findMany({
    orderBy: { criadoEm: "desc" },
    include: { cliente: { select: { nome: true } } },
  });

  const base = pageBaseUrl();

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">QR Codes</h1>
          <p className="text-sm text-neutral-500">
            Páginas de links (estilo Linktree) pra gerar QR Code / NFC — plaquinhas pros clientes.
          </p>
        </div>
        <Link
          href="/qrcodes/novo"
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          <span className="text-base leading-none">+</span>
          Novo QR Code
        </Link>
      </header>

      {pages.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-400">Nenhum QR Code criado ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Link público</th>
                <th className="px-4 py-3 font-medium">Links</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {pages.map((p) => {
                const qtdLinks = Array.isArray(p.links) ? p.links.length : 0;
                return (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5 font-medium text-neutral-800">{p.nome}</td>
                    <td className="px-4 py-2.5 text-neutral-500">{p.cliente?.nome ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <a
                        href={`${base}/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-violet-600 hover:underline"
                      >
                        /l/{p.slug}
                      </a>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500">{qtdLinks}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.ativo ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/qrcodes/${p.id}/editar`} className="text-xs font-medium text-violet-600 hover:underline">
                        Editar / QR Code
                      </Link>
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
