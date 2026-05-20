import { ClienteForm } from "../_cliente-form";
import { criarCliente } from "../actions";

export default function NovoClientePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Novo cliente</h1>
        <p className="text-sm text-neutral-500">
          Cadastre uma conta de anúncio Meta vinculada ao cliente
        </p>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <ClienteForm action={criarCliente} submitLabel="Cadastrar" />
      </div>
    </div>
  );
}
