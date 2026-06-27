import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getPredictive } from "@/lib/iara.functions";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/preditivo")({
  head: () => ({ meta: [{ title: "Motor Preditivo · IARA · Gemini" }] }),
  component: PredictivePage,
});

function PredictivePage() {
  const [horizon, setHorizon] = useState(12);
  const fn = useServerFn(getPredictive);
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["iara-pred", horizon],
    queryFn: () => fn({ data: { horizon } }),
  });

  if (isLoading) return <div className="iara-page"><div className="iara-panel">🧠 Gemini está gerando a previsão de {horizon} meses…</div></div>;
  if (error || !data) return <div className="iara-page"><div className="iara-panel">Erro: {String(error)}</div></div>;

  const chartData = [
    ...data.serie.map((p) => ({ anomes: p.anomes, real: p.pendentes, previsao: null as number | null })),
    ...data.forecast.map((p) => ({ anomes: p.anomes, real: null as number | null, previsao: p.pendentes })),
  ];

  const trend = data.slope > 0 ? "alta" : "queda";
  const trendColor = data.slope > 0 ? "var(--iara-red-l)" : "#4ade80";

  return (
    <div className="iara-page">
      <div className="iara-page-head">
        <div>
          <h1 className="iara-page-title">Motor <span>Preditivo</span></h1>
          <p className="iara-page-sub">Previsão numérica gerada pelo <strong>Gemini 3.1 Pro</strong> sobre a série mensal de processos pendentes (TCL).</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "var(--iara-text-s)" }}>Horizonte:</label>
          <select className="iara-input" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
            {[3, 6, 9, 12, 15, 18].map((h) => <option key={h} value={h}>{h} meses</option>)}
          </select>
          <span className="iara-status-badge iara-status-ativo">{isFetching ? "Calculando…" : "Ativo"}</span>
        </div>
      </div>

      <section className="iara-panel">
        <h2 className="iara-panel-title">Indicadores <span className="tag">{data.model}</span></h2>
        <div className="iara-kpi-row">
          <Kpi label="Tendência" value={trend} sub={`Slope OLS = ${data.slope}`} color={trendColor} />
          <Kpi label="R² do ajuste linear" value={data.r2.toFixed(3)} sub="Aderência base" />
          <Kpi label="Próximo mês" value={String(data.forecast[0]?.pendentes ?? "-")} sub={`Mês ${data.forecast[0]?.anomes ?? "-"}`} />
          <Kpi label={`Horizonte ${horizon}m`} value={String(data.forecast.at(-1)?.pendentes ?? "-")} sub={`Mês ${data.forecast.at(-1)?.anomes ?? "-"}`} />
        </div>
      </section>

      <section className="iara-panel">
        <h2 className="iara-panel-title">Série histórica + projeção Gemini <span className="tag">IA</span></h2>
        <div style={{ height: 340 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid stroke="rgba(45,212,191,0.08)" />
              <XAxis dataKey="anomes" stroke="#5e7a76" fontSize={10} />
              <YAxis stroke="#5e7a76" fontSize={10} />
              <Tooltip contentStyle={{ background: "#08130f", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x={data.serie.at(-1)?.anomes} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Hoje", fill: "#f59e0b", fontSize: 10 }} />
              <Line type="monotone" dataKey="real" stroke="#2dd4bf" strokeWidth={2} dot={false} name="Real (TCL)" />
              <Line type="monotone" dataKey="previsao" stroke="#818cf8" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: "#818cf8" }} name={`Previsão Gemini (${horizon}m)`} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {data.narrativa && (
        <section className="iara-panel">
          <h2 className="iara-panel-title">Análise da IA <span className="tag">Gemini</span></h2>
          <p style={{ fontSize: 13, color: "var(--iara-text-s)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{data.narrativa}</p>
        </section>
      )}

      <section className="iara-panel">
        <h2 className="iara-panel-title">Impacto nas Metas Nacionais do CNJ <span className="tag">Contexto</span></h2>
        <div className="iara-kpi-row">
          <Kpi
            label="Meta 1 · último ano apurado"
            value={data.meta1Ultimo?.indiceMeta1 != null ? `${data.meta1Ultimo.indiceMeta1}%` : "—"}
            sub={data.meta1Ultimo ? `${data.meta1Ultimo.ano} · ${data.meta1Ultimo.grau}` : "Sem dados"}
          />
          <Kpi
            label="Meta 2 · último ano apurado"
            value={data.meta2Ultimo?.indiceMeta2 != null ? `${data.meta2Ultimo.indiceMeta2}%` : "—"}
            sub={data.meta2Ultimo ? `${data.meta2Ultimo.ano} · ${data.meta2Ultimo.grau}` : "Sem dados"}
          />
        </div>
      </section>

      <section className="iara-panel">
        <h2 className="iara-panel-title">Recomendações automáticas</h2>
        <ul style={{ fontSize: 13, color: "var(--iara-text-s)", lineHeight: 1.8 }}>
          {data.slope > 0 ? (
            <>
              <li>📈 Estoque em <strong style={{ color: "var(--iara-red-l)" }}>tendência de alta</strong>. Recomenda-se mutirão nas top-10 varas com maior pendência.</li>
              <li>🎯 Reforçar <strong>Meta 2 do CNJ</strong> — projeção indica risco no horizonte de {horizon} meses.</li>
            </>
          ) : (
            <>
              <li>📉 Estoque em <strong style={{ color: "#4ade80" }}>queda</strong>. Manter ritmo de produtividade.</li>
              <li>🎯 Focar saneamento de acervo antigo e qualidade de sentenças.</li>
            </>
          )}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="iara-kpi">
      <div className="iara-kpi-label">{label}</div>
      <div className="iara-kpi-value" style={color ? { color } : undefined}>{value}</div>
      <div className="iara-kpi-foot">{sub}</div>
    </div>
  );
}
