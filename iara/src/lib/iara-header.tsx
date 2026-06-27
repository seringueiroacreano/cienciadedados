import { Link, useRouter } from "@tanstack/react-router";
import logoAsset from "@/assets/logo-iara.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const NAV = [
  { label: "Painel", to: "/" },
  { label: "Dashboards", to: "/dashboards" },
  { label: "Chat", to: "/chat" },
  { label: "Preditivo", to: "/preditivo" },
  { label: "Data Hub", to: "/data-hub" },
  { label: "Alertas", to: "/alertas" },
] as const;

export function IaraHeader({ user }: { user?: { email?: string | null; name?: string | null } | null }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(user?.email ?? null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (user) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [user]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const initials = (user?.name || email || "IA").slice(0, 2).toUpperCase();

  return (
    <header className="iara-header">
      <Link to="/" className="iara-logo" onClick={() => setMenuOpen(false)}>
        <img className="iara-logo-mark" src={logoAsset.url} alt="Logo IARA" />
        <span className="iara-logo-text">
          <span className="iara-logo-i">I</span>
          <span className="iara-logo-a">A</span>
          <span className="iara-logo-ra">ra</span>
        </span>
        <span className="iara-logo-tagline">
          <span className="iara-logo-tagline-full">
            Inteligência Artificial de Rastreamento e Aprendizado de Dados
          </span>
          <span className="iara-logo-tagline-sub">do Tribunal de Justiça do Acre</span>
        </span>
      </Link>

      <nav className="iara-nav" aria-label="Navegação principal">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="iara-nav-item"
            activeProps={{ className: "iara-nav-item active" }}
            activeOptions={{ exact: n.to === "/" }}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="iara-header-right">
        <div className="iara-badge-notif" aria-label="Alertas">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="iara-badge-dot" aria-hidden="true" />
        </div>
        {email ? (
          <button
            type="button"
            className="iara-user-chip"
            onClick={async () => {
              await supabase.auth.signOut();
              router.navigate({ to: "/auth" });
            }}
            title="Sair"
          >
            <div className="iara-user-avatar">{initials}</div>
            <div className="iara-user-meta">
              <span className="iara-user-name">{email.split("@")[0]}</span>
              <span className="iara-user-role">Sair</span>
            </div>
          </button>
        ) : (
          <Link to="/auth" className="iara-user-chip">
            <div className="iara-user-avatar">IA</div>
            <div className="iara-user-meta">
              <span className="iara-user-name">Entrar</span>
              <span className="iara-user-role">Acessar IARA</span>
            </div>
          </Link>
        )}
        <button
          type="button"
          className="iara-menu-toggle"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span /><span /><span />
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="iara-mobile-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <nav className="iara-mobile-nav" aria-label="Navegação móvel">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="iara-mobile-nav-item"
                activeProps={{ className: "iara-mobile-nav-item active" }}
                activeOptions={{ exact: n.to === "/" }}
                onClick={() => setMenuOpen(false)}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </header>
  );
}
