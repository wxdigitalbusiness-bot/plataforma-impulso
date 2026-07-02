"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// ── Tipos ──────────────────────────────────────────────────────────────────────
type Cliente = { id: number; nome: string };

type Props = {
  children: React.ReactNode;
  userName: string;
  crmClientes: Cliente[];
  logoutAction: () => void | Promise<void>;
};

// ── Ícones SVG ────────────────────────────────────────────────────────────────
function Ico({ d, className = "h-5 w-5 shrink-0" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const D = {
  home:      "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  clients:   "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  pamphlet:  "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z",
  bell:      "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  bot:       "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z",
  phone:     "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
  crm:       "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  chevL:     "M15 19l-7-7 7-7",
  chevR:     "M9 5l7 7-7 7",
  chevD:     "M19 9l-7 7-7-7",
  chevU:     "M5 15l7-7 7 7",
  logout:    "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
};

// ── Item de nav simples ────────────────────────────────────────────────────────
function NavItem({
  href, label, icon, active, collapsed, exact = false, pathname,
}: {
  href: string; label: string; icon: string;
  active?: boolean; collapsed: boolean; exact?: boolean; pathname: string;
}) {
  const isActive = active ?? (exact ? pathname === href : pathname.startsWith(href));
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        isActive
          ? "bg-neutral-900 text-white"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      }`}
    >
      <Ico d={icon} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({
  collapsed, onToggle, pathname, crmClientes, userName, logoutAction,
}: {
  collapsed: boolean;
  onToggle: () => void;
  pathname: string;
  crmClientes: Cliente[];
  userName: string;
  logoutAction: () => void | Promise<void>;
}) {
  const [crmOpen, setCrmOpen] = useState(() => pathname.includes("/crm"));

  // Abre o dropdown se navegar para rota CRM
  useEffect(() => {
    if (pathname.includes("/crm")) setCrmOpen(true);
  }, [pathname]);

  const isCrmActive = pathname.includes("/crm");

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 border-r border-neutral-200 bg-white transition-all duration-200 ${
        collapsed ? "w-[3.75rem]" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center border-b border-neutral-100 ${collapsed ? "justify-center px-0 py-4" : "justify-between px-5 py-4"}`}>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">Plataforma Impulso</p>
            <p className="truncate text-[11px] text-neutral-400">Agência Impulso</p>
          </div>
        )}
        {collapsed && (
          <span className="text-xs font-bold text-neutral-700">PI</span>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex flex-1 flex-col gap-0.5 overflow-y-auto py-3 ${collapsed ? "px-2" : "px-3"}`}>
        <NavItem href="/"          label="Dashboard"             icon={D.home}     collapsed={collapsed} exact pathname={pathname} />
        <NavItem href="/clientes"  label="Clientes"              icon={D.clients}  collapsed={collapsed} pathname={pathname} />
        <NavItem href="/panfletagem" label="Panfletagem"         icon={D.pamphlet} collapsed={collapsed} pathname={pathname} />
        <NavItem href="/alertas"   label="Histórico de alertas"  icon={D.bell}     collapsed={collapsed} pathname={pathname} />
        <NavItem href="/bot"       label="Bot Marketing Impulso" icon={D.bot}      collapsed={collapsed} pathname={pathname} />
        <NavItem href="/whatsapp"  label="WhatsApp"              icon={D.phone}    collapsed={collapsed} pathname={pathname} />

        {/* ── CRM com dropdown ── */}
        <div>
          <button
            onClick={() => {
              if (collapsed) { onToggle(); setCrmOpen(true); return; }
              setCrmOpen((v) => !v);
            }}
            title={collapsed ? "CRM" : undefined}
            className={`flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors ${
              isCrmActive
                ? "bg-violet-50 text-violet-700"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            } ${collapsed ? "justify-center" : "justify-between"}`}
          >
            <span className={`flex items-center ${collapsed ? "" : "gap-3"}`}>
              <Ico d={D.crm} className={`h-5 w-5 shrink-0 ${isCrmActive ? "text-violet-600" : ""}`} />
              {!collapsed && <span>CRM</span>}
            </span>
            {!collapsed && (
              <Ico d={crmOpen ? D.chevU : D.chevD} className="h-3.5 w-3.5 text-neutral-400" />
            )}
          </button>

          {/* Sub-itens */}
          {!collapsed && crmOpen && (
            <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-neutral-100 pl-3">
              {[
                { href: "/crm/leads",          label: "Leads" },
                { href: "/crm/etapas",         label: "Etapas do Funil" },
                { href: "/crm/motivos-perda",  label: "Motivo de Perda" },
                { href: "/crm/whatsapp",       label: "WhatsApp" },
                { href: "/crm/logs",           label: "Logs de Webhooks" },
              ].map(({ href, label }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`truncate rounded-md px-2 py-1.5 text-xs transition-colors ${
                      active
                        ? "bg-violet-600 font-semibold text-white"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Footer: user + logout + toggle */}
      <div className={`border-t border-neutral-200 ${collapsed ? "px-2 py-3" : "px-4 py-4"}`}>
        {!collapsed && (
          <>
            <p className="text-[10px] uppercase tracking-wide text-neutral-400">Logado como</p>
            <p className="truncate text-sm font-medium text-neutral-800">{userName}</p>
            <p className="mt-0.5 text-[10px] text-neutral-400">Plataforma Impulso v1.0.0</p>
          </>
        )}
        <form action={logoutAction} className={collapsed ? "" : "mt-2"}>
          <button
            type="submit"
            title={collapsed ? "Sair" : undefined}
            className={`flex w-full items-center rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 ${
              collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-1.5"
            }`}
          >
            <Ico d={D.logout} className="h-4 w-4 shrink-0" />
            {!collapsed && "Sair"}
          </button>
        </form>

        {/* Botão colapsar/expandir */}
        <button
          onClick={onToggle}
          title={collapsed ? "Expandir menu" : "Minimizar menu"}
          className={`mt-2 flex w-full items-center justify-center rounded-lg py-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600`}
        >
          <Ico d={collapsed ? D.chevR : D.chevL} className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

// ── AppShell (exportado) ───────────────────────────────────────────────────────
export function AppShell({ children, userName, crmClientes, logoutAction }: Props) {
  const pathname = usePathname();

  // Persiste estado colapsado no localStorage
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    setCollapsed((v) => {
      localStorage.setItem("sidebar-collapsed", String(!v));
      return !v;
    });
  }

  // CRM usa fullscreen (sem max-width nem padding)
  const isFullscreen = pathname.includes("/crm");

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — renderiza como expandida no SSR para evitar flash */}
      <Sidebar
        collapsed={mounted ? collapsed : false}
        onToggle={toggleCollapse}
        pathname={pathname}
        crmClientes={crmClientes}
        userName={userName}
        logoutAction={logoutAction}
      />

      <main className={`flex-1 ${isFullscreen ? "overflow-hidden" : "overflow-auto"}`}>
        {isFullscreen ? (
          <div className="flex h-screen flex-col">{children}</div>
        ) : (
          <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
        )}
      </main>
    </div>
  );
}
