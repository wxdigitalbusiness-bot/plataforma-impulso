import { ClienteForm } from "../_cliente-form";
import { criarCliente } from "../_cliente-actions";

export default function NovoClientePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Novo cliente</h1>
        <p className="text-sm text-neutral-500">
          Crie o cliente primeiro. As contas de anúncio (Meta Ads, Google Ads)
          são adicionadas depois, dentro da página do cliente.
        </p>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <ClienteForm action={criarCliente} submitLabel="Criar cliente" />
      </div>
    </div>
  );
}
