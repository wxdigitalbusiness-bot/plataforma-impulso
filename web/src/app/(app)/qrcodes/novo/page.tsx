import Link from "next/link";
import { db } from "@/lib/db";
import { LinkPageForm } from "../_form";

export const dynamic = "force-dynamic";

export default async function NovoQrCodePage() {
  const clientes = await db.cliente.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/qrcodes" className="text-xs text-neutral-500 hover:underline">← QR Codes</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Novo QR Code</h1>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <LinkPageForm clientes={clientes} pageBaseUrl={`${process.env.AUTH_URL ?? "http://localhost:3000"}/l`} />
      </div>
    </div>
  );
}
