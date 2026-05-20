import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const clientes = await db.clienteAtivo.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-neutral-500">
            {clientes.length} {clientes.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}
          </p>
        </div>
        <Link
          href="/clientes/novo"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Novo cliente
        </Link>
      </header>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Ad Account</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3 text-right">Limite</th>
              <th className="px-4 py-3">Alerta</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {clientes.map((c) => (
              <tr key={c.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 font-medium">{c.nome}</td>
                <td className="px-4 py-3 text-neutral-600">{c.empresa}</td>
                <td className="px-4 py-3 text-xs text-neutral-500">{c.metaAdAccountId}</td>
                <td className="px-4 py-3 text-neutral-600">{c.whatsappAlerta ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: c.moeda,
                  }).format(Number(c.limiteMinimo))}
                </td>
                <td className="px-4 py-3">
                  {c.receberAlertaSaldo ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      ativado
                    </span>
                  ) : (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      desligado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.ativo ? (
                    <span className="text-xs text-emerald-700">ativo</span>
                  ) : (
                    <span className="text-xs text-neutral-400">inativo</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/clientes/${c.id}/editar`}
                    className="text-xs font-medium text-neutral-700 hover:underline"
                  >
                    editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
