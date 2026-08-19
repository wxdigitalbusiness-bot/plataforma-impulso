// Verifica quantos dias faltam pro META_ACCESS_TOKEN expirar (via Graph API
// debug_token). O token é de usuário (não "nunca expira" — a Meta exige
// Acesso Avançado com App Review pra isso, não compensa pra uso interno de
// uma agência só), então vence a cada ~60 dias e precisa ser regenerado
// manualmente em Business Settings → Usuários do sistema → Gerar novo token.

const AVISO_DIAS = Number(process.env.META_TOKEN_AVISO_DIAS ?? 7);

export type MetaTokenStatus = {
  valido: boolean;
  diasRestantes: number | null; // null = sem expiração (token de app, ou "nunca")
  expiraEm: Date | null;
  erro: string | null;
};

export async function verificarTokenMeta(): Promise<MetaTokenStatus> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return { valido: false, diasRestantes: null, expiraEm: null, erro: "META_ACCESS_TOKEN ausente no servidor" };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/debug_token?input_token=${token}&access_token=${token}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();

    if (!res.ok || json.error) {
      return { valido: false, diasRestantes: null, expiraEm: null, erro: json?.error?.message ?? `HTTP ${res.status}` };
    }

    const data = json.data as { is_valid?: boolean; expires_at?: number } | undefined;
    if (!data?.is_valid) {
      return { valido: false, diasRestantes: null, expiraEm: null, erro: "Token inválido ou revogado" };
    }

    const expiresAt = data.expires_at ?? 0;
    if (!expiresAt) {
      return { valido: true, diasRestantes: null, expiraEm: null, erro: null };
    }

    const expiraEm = new Date(expiresAt * 1000);
    const diasRestantes = Math.ceil((expiraEm.getTime() - Date.now()) / 86_400_000);
    return { valido: true, diasRestantes, expiraEm, erro: null };
  } catch (err) {
    return { valido: false, diasRestantes: null, expiraEm: null, erro: String(err) };
  }
}

export function precisaAvisar(status: MetaTokenStatus): boolean {
  if (!status.valido) return true;
  return status.diasRestantes !== null && status.diasRestantes <= AVISO_DIAS;
}
