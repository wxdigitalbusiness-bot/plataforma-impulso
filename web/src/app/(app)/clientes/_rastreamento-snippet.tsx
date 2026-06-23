"use client";

import { useState } from "react";

const BASE_URL = "https://plataforma.mktimpulso.com.br";

function buildSnippet(slug: string) {
  return `<!-- Rastreamento WhatsApp — CRM Impulso -->
<script>
(function(){
  var p=new URLSearchParams(location.search);
  var g=p.get('gclid'),w=p.get('wbraid'),b=p.get('gbraid');
  if(!g&&!w&&!b)return;
  var q='';
  if(g)q='gclid='+g;
  if(w)q+=(q?'&':'')+'wbraid='+w;
  if(b)q+=(q?'&':'')+'gbraid='+b;
  document.querySelectorAll('a[href*="wa.me"],a[href*="whatsapp"]').forEach(function(el){
    el.href='${BASE_URL}/r/wa/${slug}?'+q;
  });
})();
<\/script>`;
}

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
    >
      {copied ? "✓ Copiado!" : label}
    </button>
  );
}

export function RastreamentoSnippet({ slug }: { slug: string }) {
  const link = `${BASE_URL}/r/wa/${slug}`;
  const snippet = buildSnippet(slug);

  return (
    <div className="space-y-4 pt-2">
      {/* Link rastreado */}
      <div>
        <p className="mb-1 text-xs font-medium text-neutral-600">Link de rastreamento gerado</p>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <code className="flex-1 truncate text-xs text-neutral-700">{link}</code>
          <CopyButton text={link} label="copiar link" />
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          O snippet abaixo instala este link automaticamente em todos os botões de WhatsApp da página.
        </p>
      </div>

      {/* Snippet head */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-medium text-neutral-600">
            Snippet para o{" "}
            <code className="rounded bg-neutral-100 px-1 text-neutral-700">&lt;head&gt;</code>{" "}
            da landing page
          </p>
          <CopyButton text={snippet} label="Copiar snippet" />
        </div>
        <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-950 p-3 text-xs leading-relaxed text-green-400">
          <code>{snippet}</code>
        </pre>
        <p className="mt-1 text-xs text-neutral-400">
          Cole no <code className="rounded bg-neutral-100 px-1">&lt;head&gt;</code> da landing page. Quando o visitante chega via Google Ads, o gclid é lido da URL e injetado no link do WhatsApp automaticamente.
        </p>
      </div>
    </div>
  );
}
