"use server";
import { deletePortalSession } from "@/lib/portal-session";
import { redirect } from "next/navigation";

export async function logoutPortal() {
  await deletePortalSession();
  redirect("/portal/login");
}
