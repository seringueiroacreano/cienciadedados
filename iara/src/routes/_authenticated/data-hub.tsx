import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDataSources, getOverviewMetrics } from "@/lib/iara.functions";

export const Route = createFileRoute("/_authenticated/data-hub")({
  head: () => ({ meta: [{ title: "Data Hub · IARA" }] }),
  component: DataHubPage,
});

function DataHubPage() {
  const fn = useServerFn(getDataSources);
  const mfn = useServerFn(getOverviewMetrics);
  const sources = useQuery({ queryKey: ["iara-sources"], queryFn: () => fn() });
  const m = useQuery({ queryKey: ["iara-overview"], queryFn: () => mfn() });

  return (
    <div className="iara-page">
      <div className="iara-page-head">
        <div>
          <h1 className="iara-page-title">Data <span>Hub</span></h1>
          <p className="iara-page-sub">Fonte única de verdade — integração governada das fontes do TJAC e CNJ. Arquitetura baseada em boas práticas de TIC (catálogo, lineage, qualidade) e Ciência de Dados (datasets versionados).</p>
        </div>
        <span className="iara-status-badge iara-status-sync">Sincronizando</span>
      </div>

      <section className="iara-panel">
        <h2 className="iara-panel-title">Fontes conectadas <span className="tag">Catálogo IARA</span></h2>
        <table className="iara-table">
          <thead><tr><th>Fonte</th><th>Categoria</th><th>Descrição</th><th>Status</th><th>Registros</th><th>Última sync</th></tr></thead>
          <tbody>
            {((sources.data ?? []) as Array<{ id: string; nome: string; categoria: string | null; descricao: string | null; status: string; registros: number; ultima_sync: string | null }>).map((s) => (
              <tr key={s.id}>
                <td><strong>{s.nome}</strong></td>
                <td>{s.categoria}</td>
                <td>{s.descricao}</td>
                <td>
                  <span className={`iara-status-badge ${
                    s.status === "conectado" ? "iara-status-ativo" :
                    s.status === "sincronizando" ? "iara-status-sync" :
                    s.status === "erro" ? "iara-status-alerta" : "iara-status-auto"
                  }`}>{s.status}</span>
                </td>
                <td style={{ fontFamily: "var(--font-mono-iara)" }}>{Number(s.registros).toLocaleString("pt-BR")}</td>
                <td style={{ fontFamily: "var(--font-mono-iara)", color: "var(--iara-text-d)" }}>
                  {s.ultima_sync ? new Date(s.ultima_sync).toLocaleString("pt-BR") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="iara-panel">
        <h2 className="iara-panel-title">Datasets em uso pela IARA</h2>
        <div className="iara-kpi-row">
          <KpiCard label="TCL · série mensal" value={m.data?.tcl.serie.length ?? 0} foot="anos-mês" />
          <KpiCard label="Violência doméstica" value={m.data?.violencia.total ?? 0} foot={`${m.data?.violencia.validos ?? 0} válidos`} />
          <KpiCard label="Ações penais (A+B)" value={m.data?.acoesPenais.total ?? 0} foot="Conhecimento criminal" />
          <KpiCard label="Alertas ativos" value={m.data?.alertas.total ?? 0} foot="Detectados pela IARA" />
        </div>
      </section>

      <section className="iara-panel">
        <h2 className="iara-panel-title">Princípios de governança (TIC · Ciência de Dados)</h2>
        <ul style={{ fontSize: 13, color: "var(--iara-text-s)", lineHeight: 1.8 }}>
          <li>🔐 <strong>RLS por papel</strong> — dados acessíveis somente após autenticação.</li>
          <li>📚 <strong>Catálogo de dados</strong> — cada fonte registrada com descrição, categoria e dono.</li>
          <li>♻️ <strong>Sync rastreável</strong> — última sincronização e contagem de registros por fonte.</li>
          <li>🧪 <strong>Datasets versionados</strong> — TCL, violência e ações penais como tabelas analíticas isoladas.</li>
          <li>🔭 <strong>Lineage</strong> — eproc, SAJ, PJe e DataJud unificados para alimentar Motor Preditivo e Chat.</li>
        </ul>
      </section>
    </div>
  );
}

function KpiCard({ label, value, foot }: { label: string; value: number; foot: string }) {
  return (
    <div className="iara-kpi">
      <div className="iara-kpi-label">{label}</div>
      <div className="iara-kpi-value">{Number(value).toLocaleString("pt-BR")}</div>
      <div className="iara-kpi-foot">{foot}</div>
    </div>
  );
}
