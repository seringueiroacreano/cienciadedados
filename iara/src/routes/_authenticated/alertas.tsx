import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAlertas } from "@/lib/iara.functions";

export const Route = createFileRoute("/_authenticated/alertas")({
  head: () => ({ meta: [{ title: "Alertas · IARA" }] }),
  component: AlertasPage,
});

function AlertasPage() {
  const fn = useServerFn(getAlertas);
  const { data, isLoading } = useQuery({ queryKey: ["iara-alertas"], queryFn: () => fn() });

  return (
    <div className="iara-page">
      <div className="iara-page-head">
        <div>
          <h1 className="iara-page-title">Sistema de <span>Alertas</span></h1>
          <p className="iara-page-sub">Detectados automaticamente pela IARA a partir dos dados do TJAC. Severidade: crítica → baixa.</p>
        </div>
        <span className="iara-status-badge iara-status-alerta">{data?.length ?? 0} ativos</span>
      </div>

      <section className="iara-panel">
        {isLoading && <p>Buscando alertas…</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {((data ?? []) as Array<{ id: string; titulo: string; mensagem: string; severidade: "critica" | "alta" | "media" | "baixa"; origem: string | null; unidade: string | null; criado_em: string }>).map((a) => (
            <div key={a.id} className={`iara-alert-card ${a.severidade}`}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "var(--iara-text-p)", fontSize: 14 }}>{a.titulo}</strong>
                  <span className="iara-status-badge" style={{
                    background: a.severidade === "critica" ? "rgba(220,38,38,0.2)" :
                                a.severidade === "alta" ? "rgba(245,158,11,0.2)" :
                                a.severidade === "media" ? "rgba(8,145,178,0.2)" : "rgba(94,122,118,0.2)",
                    color: a.severidade === "critica" ? "var(--iara-red-l)" :
                           a.severidade === "alta" ? "var(--iara-amber-l)" :
                           a.severidade === "media" ? "var(--iara-cyan-l)" : "var(--iara-text-s)",
                  }}>{a.severidade.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--iara-text-s)", marginTop: 4 }}>{a.mensagem}</div>
                <div style={{ fontSize: 10, color: "var(--iara-text-d)", fontFamily: "var(--font-mono-iara)", marginTop: 6 }}>
                  {a.origem} {a.unidade ? `· ${a.unidade}` : ""} · {new Date(a.criado_em).toLocaleString("pt-BR")}
                </div>
              </div>
            </div>
          ))}
          {!isLoading && data?.length === 0 && <p style={{ color: "var(--iara-text-s)" }}>Sem alertas ativos no momento.</p>}
        </div>
      </section>
    </div>
  );
}
