import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import logoAsset from "@/assets/logo-iara.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar · IARA" }, { name: "description", content: "Acesse a IARA — Inteligência Artificial de Rastreamento e Aprendizado de Dados do TJAC." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboards" });
    } catch (err: any) {
      setError(err?.message ?? "Falha ao autenticar");
    } finally { setLoading(false); }
  }

  async function google() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboards" });
    if (result.error) setError(String(result.error.message ?? result.error));
    else if (!result.redirected) navigate({ to: "/dashboards" });
  }

  return (
    <div className="iara-auth-shell">
      <div className="iara-auth-card">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <img src={logoAsset.url} alt="" width={56} height={56} style={{ borderRadius: 12, border: "1px solid var(--iara-border-h)" }} />
        </div>
        <h1 className="iara-auth-title">{mode === "login" ? "Entrar na IARA" : "Criar conta"}</h1>
        <p className="iara-auth-sub">Inteligência Artificial de Rastreamento e Aprendizado de Dados — TJAC</p>

        <form onSubmit={submit} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "signup" && (
            <div>
              <label className="iara-auth-label">Nome completo</label>
              <input className="iara-auth-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="iara-auth-label">E-mail</label>
            <input className="iara-auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="iara-auth-label">Senha</label>
            <input className="iara-auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <div style={{ color: "var(--iara-red-l)", fontSize: 12 }}>{error}</div>}
          <button className="iara-btn" type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <div className="iara-auth-divider">ou</div>
        <button className="iara-google-btn" onClick={google}>
          <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.7 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C40 35.5 44 30.3 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
          Continuar com Google
        </button>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--iara-text-s)", marginTop: 20 }}>
          {mode === "login" ? (
            <>Não tem conta?{" "}<button type="button" className="iara-btn-ghost" onClick={() => setMode("signup")}>Criar</button></>
          ) : (
            <>Já tem conta?{" "}<button type="button" className="iara-btn-ghost" onClick={() => setMode("login")}>Entrar</button></>
          )}
        </p>
      </div>
    </div>
  );
}
