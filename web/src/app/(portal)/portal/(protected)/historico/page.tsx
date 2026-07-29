import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { listarHistoricoPortal } from "@/lib/historico";
import { tipoInfo } from "@/lib/historico-tipos";

export const dynamic = "force-dynamic";

const MESES = ["janeiro","fevereiro","março","abril","maio","junho",
               "julho","agosto","setembro","outubro","novembro","dezembro"];

function fmtData(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function rotuloMes(iso: string) {
  const [y, m] = iso.split("-");
  return `${MESES[Number(m) - 1]} de ${y}`;
}

export default async function PortalHistoricoPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const entradas = await listarHistoricoPortal(session.clienteId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          O que fizemos por você
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Registro das ações da equipe na sua conta.
        </p>
      </header>

      {entradas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-12 text-center text-sm text-neutral-400">
          Ainda não há registros para mostrar.
        </p>
      ) : (
        <div className="space-y-1">
          {entradas.map((e, i) => {
            const info = tipoInfo(e.tipo);
            const mes = rotuloMes(e.data_acao);
            const novoMes = i === 0 || mes !== rotuloMes(entradas[i - 1].data_acao);

            return (
              <div key={e.id}>
                {novoMes && (
                  <p className="px-1 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 first:pt-0">
                    {mes}
                  </p>
                )}
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${info.cor}`}>
                      {info.label}
                    </span>
                    <span className="text-xs text-neutral-400">{fmtData(e.data_acao)}</span>
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
