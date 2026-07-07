"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function toggleSomentePago(clienteId: number, atual: boolean) {
  await db.cliente.update({
    where: { id: clienteId },
    data: { crmSomentePago: !atual },
  });
  revalidatePath("/crm/leads");
}
