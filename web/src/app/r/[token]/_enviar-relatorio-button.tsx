"use client";

// Botão "Enviar relatório" — abre WhatsApp Web/App com a mensagem pronta.
// Aparece só pra usuário da agência (autenticado); cliente vendo o link público não vê.

type Props = {
  /** Número WhatsApp no formato DDI+DDD+número, ex: "5563999999999". null = não cadastrado */
  phone: string | null;
  /** Texto de saudação que vai antes do link (ex: "Olá! Esse é o seu relatório de maio de 2026."). */
  mensagemPrefix: string;
};

export function EnviarRelatorioButton({ phone, mensagemPrefix }: Props) {
  function abrirWhatsApp() {
    if (!phone) return;
    // Usa a URL atual do relatório (window.location.href) — assim
    // mesmo se o token mudar ou a página for redirecionada, manda o link certo.
    const linkRelatorio = typeof window !== "undefined" ? window.location.href : "";
    const texto = `${mensagemPrefix}

Acesse pelo link:
${linkRelatorio}

Qualquer dúvida estamos à disposição! 🚀
— Equipe Impulso`;

    const waUrl = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  if (!phone) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-400"
        title="O cliente não tem WhatsApp cadastrado. Edite o perfil para adicionar."
      >
        📲 Sem WhatsApp cadastrado
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={abrirWhatsApp}
      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700"
      title={`Abre o WhatsApp para enviar pro cliente (${phone})`}
    >
      📲 Enviar pro cliente
    </button>
  );
}
