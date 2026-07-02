"use client";

import { useEffect, useState } from "react";

function buildSnippet(origin: string, clientKey: string | null) {
  const elseClause = clientKey
    ? `el.href='${origin}/r/wa/${clientKey}?'+q;`
    : `/* link wa.me sem client_key — adicione a chave n8n ao cliente */`;

  return `<!-- Rastreamento WhatsApp — CRM Impulso -->
<script>
(function(){
  var p=new URLSearchParams(location.search);
  var g=p.get('gclid'),w=p.get('wbraid'),b=p.get('gbraid');
  var us=p.get('utm_source'),um=p.get('utm_medium'),uc=p.get('utm_campaign'),ut=p.get('utm_term');
  if(!g&&!w&&!b&&!us)return;
  var q='';
  if(g)q='gclid='+encodeURIComponent(g);
  if(w)q+=(q?'&':'')+'wbraid='+encodeURIComponent(w);
  if(b)q+=(q?'&':'')+'gbraid='+encodeURIComponent(b);
  if(us)q+=(q?'&':'')+'utm_source='+encodeURIComponent(us);
  if(um)q+=(q?'&':'')+'utm_medium='+encodeURIComponent(um);
  if(uc)q+=(q?'&':'')+'utm_campaign='+encodeURIComponent(uc);
  if(ut)q+=(q?'&':'')+'utm_term='+encodeURIComponent(ut);
  function inject(){
    document.querySelectorAll('a[href*="wa.me"],a[href*="whatsapp"],a[href*="/r/wa/"],a[href*="/api/w/"]').forEach(function(el){
      if(el.href.indexOf('?'+q)<0&&el.href.indexOf('&'+q)<0){
        if(el.href.indexOf('/api/w/')>-1){
          el.href=el.href+(el.href.indexOf('?')>-1?'&':'?')+q;
        } else {
          ${elseClause}
        }
      }
    });
  }
  window.addEventListener('load',function(){ inject(); setTimeout(inject,1000); });
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

export function RastreamentoSnippet({ clientKey }: { clientKey: string | null }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const resolvedOrigin = origin || "https://plataforma.marketingimpulso.com";
  const snippet = buildSnippet(resolvedOrigin, clientKey);

  return (
    <div className="space-y-4 pt-2">
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
          Cole no <code className="rounded bg-neutral-100 px-1">&lt;head&gt;</code> da landing page.
          Quando o visitante chega via Google Ads ou campanha com UTMs, os parâmetros são
          injetados automaticamente nos links de WhatsApp da página e o lead é atribuído no CRM.
        </p>
      </div>
    </div>
  );
}
