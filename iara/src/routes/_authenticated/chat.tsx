import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string; tools?: { name: string; args: unknown }[] };

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat Analítico · IARA · Gemini" }] }),
  component: ChatPage,
});

const SUGESTOES = [
  "Quais varas têm maior estoque de processos pendentes?",
  "Mostre a tendência mensal de baixados em 2025.",
  "Em quais órgãos a violência doméstica leva mais tempo?",
  "Liste ações penais paradas há mais de 1000 dias.",
  "Compare baixados de 202401-202412 com 202501-202512.",
  "Qual o índice da Meta 1 e da Meta 2 no último ano apurado?",
  "Quais unidades estão mais distantes de cumprir a Meta 1?",
  "O que é a Meta 2 do CNJ?",
];

function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Olá! Sou a **IARA**. Tenho ferramentas reais para consultar os dados do TJAC (TCL, violência doméstica, ações penais, alertas) e os Glossários do CNJ. Pergunte em português." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const json = await resp.json().catch(() => ({ error: "Resposta inválida" }));
      if (!resp.ok) {
        setMessages((m) => [...m, { role: "assistant", content: `❌ Erro ${resp.status}: ${json.error ?? ""}` }]);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: json.content ?? "(sem conteúdo)", tools: json.tools }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `❌ ${String(e)}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="iara-page">
      <div className="iara-page-head">
        <div>
          <h1 className="iara-page-title">Chat <span>Analítico</span></h1>
          <p className="iara-page-sub"><strong>google/gemini-3.1-pro-preview</strong> com <strong>tool calling</strong> · consultas reais ao banco do TJAC.</p>
        </div>
      </div>

      <div className="iara-chat-wrap">
        <div className="iara-chat-history" ref={scrollRef} style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {messages.map((m, i) => (
            <div key={i} className={`iara-msg ${m.role}`}>
              <div className="iara-msg-avatar">{m.role === "user" ? "Eu" : "IA"}</div>
              <div style={{ flex: 1 }}>
                <div className="iara-msg-role">{m.role === "user" ? "Você" : "IARA · Gemini"}</div>
                {m.tools && m.tools.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "4px 0" }}>
                    {m.tools.map((t, j) => (
                      <span key={j} className="iara-status-badge iara-status-ativo" style={{ fontSize: 10 }} title={JSON.stringify(t.args)}>
                        🔧 {t.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="iara-msg-body" style={{ whiteSpace: "pre-wrap" }}>{m.content || (loading && i === messages.length - 1 ? "▍" : "")}</div>
              </div>
            </div>
          ))}
          {loading && <div className="iara-msg assistant"><div className="iara-msg-avatar">IA</div><div className="iara-msg-body" style={{ color: "var(--iara-text-s)" }}>Consultando dados…</div></div>}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SUGESTOES.map((s) => (
            <button key={s} className="iara-btn-ghost" onClick={() => send(s)} disabled={loading}>{s}</button>
          ))}
        </div>

        <form className="iara-chat-form" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <textarea
            className="iara-chat-input" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte à IARA — ela vai consultar o banco com tool calling…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          />
          <button className="iara-btn" disabled={loading || !input.trim()}>{loading ? "..." : "Enviar"}</button>
        </form>
      </div>
    </div>
  );
}
