'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

const POLL_MS = 15_000;
const QR_SECS = 30;

type State = 'loading' | 'qr' | 'connected' | 'error';

export default function QrPage() {
  const { token } = useParams<{ token: string }>();

  const [state, setState]       = useState<State>('loading');
  const [qrSrc, setQrSrc]       = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(QR_SECS);

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startCountdown() {
    setCountdown(QR_SECS);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);
  }

  async function poll() {
    try {
      const res = await fetch(`/api/whatsapp/qr/${token}`);
      const data = await res.json();

      if (!res.ok) {
        if (pollRef.current) clearInterval(pollRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setErrorMsg(data.error ?? 'Sessão inválida ou expirada.');
        setState('error');
        return;
      }

      if (data.status === 'connected') {
        if (pollRef.current) clearInterval(pollRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setState('connected');
        return;
      }

      if (data.qr?.base64) {
        const src = data.qr.base64.startsWith('data:') ? data.qr.base64 : `data:image/png;base64,${data.qr.base64}`;
        setQrSrc(src);
        setState('qr');
        startCountdown();
      }
    } catch {
      setErrorMsg('Erro de conexão. Verifique sua internet.');
      setState('error');
    }
  }

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const timerPct = (countdown / QR_SECS) * 100;

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '20px', padding: '40px 36px', maxWidth: '420px', width: '100%', textAlign: 'center', color: '#e2e8f0' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>📱</div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Reconectar WhatsApp</h1>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '28px', lineHeight: 1.5 }}>
          Escaneie o QR Code abaixo com o WhatsApp do seu celular para reconectar.
        </p>

        {state === 'loading' && (
          <div>
            <div style={{ width: '52px', height: '52px', border: '4px solid #2d3148', borderTopColor: '#25d366', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#64748b', fontSize: '14px' }}>Gerando QR Code...</p>
          </div>
        )}

        {state === 'qr' && (
          <div>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '14px', display: 'inline-block', marginBottom: '20px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
            </div>
            <ol style={{ textAlign: 'left', background: '#0f1117', borderRadius: '10px', padding: '16px 18px', marginBottom: '20px', listStyle: 'decimal', paddingLeft: '32px' }}>
              {[
                <>Abra o <strong>WhatsApp</strong> no seu celular</>,
                <>Toque em <strong>Menu (⋮)</strong> ou <strong>Configurações</strong></>,
                <>Selecione <strong>Dispositivos conectados</strong></>,
                <>Toque em <strong>Conectar dispositivo</strong> e aponte a câmera para o QR Code acima</>,
              ].map((step, i) => (
                <li key={i} style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px', lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>
            <div style={{ background: '#0f1117', borderRadius: '99px', height: '4px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{ height: '100%', background: '#25d366', width: `${timerPct}%`, transition: 'width 1s linear' }} />
            </div>
            <p style={{ fontSize: '11px', color: '#475569' }}>
              {countdown > 0 ? `Atualizando QR Code em ${countdown}s…` : 'Atualizando…'}
            </p>
          </div>
        )}

        {state === 'connected' && (
          <div>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
            <p style={{ fontSize: '20px', fontWeight: 700, color: '#4ade80', marginBottom: '8px' }}>WhatsApp Conectado!</p>
            <p style={{ fontSize: '14px', color: '#64748b' }}>Seu WhatsApp foi reconectado com sucesso. Você já pode fechar esta página.</p>
          </div>
        )}

        {state === 'error' && (
          <div>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <p style={{ fontSize: '14px', color: '#f87171', marginBottom: '20px', lineHeight: 1.5 }}>{errorMsg}</p>
            <button
              onClick={() => { setState('loading'); poll(); }}
              style={{ background: '#25d366', color: '#0a1a0f', border: 'none', padding: '12px 28px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
