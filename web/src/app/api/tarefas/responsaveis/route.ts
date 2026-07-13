import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [admins, clientes] = await Promise.all([
      db.usuario.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, email: true },
        orderBy: { nome: "asc" },
      }),
      db.cliente.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
    ]);
    return NextResponse.json({ admins, clientes });
  } catch {
    return NextResponse.json({ admins: [], clientes: [] });
  }
}
