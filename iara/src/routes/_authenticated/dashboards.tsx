import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getOverviewMetrics, getTopUnidades, getViolenciaPorOrgao, getFilterOptions, getComparativo, getMetasNacionais, getUnidadesJudiciais } from "@/lib/iara.functions";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";

type Persona = "magistrado" | "gestor" | "servidor";

const PERIODOS_RAPIDOS: { label: string; ini: number; fim: number }[] = [
  { label: "Últimos 3 meses", ini: 202604, fim: 202606 },
  { label: "Últimos 12 meses", ini: 202507, fim: 202606 },
  { label: "Ano corrente", ini: 202601, fim: 202612 },
  { label: "Ano anterior", ini: 202501, fim: 202512 },
];

export const Route = createFileRoute("/_authenticated/dashboards")({
  head: () => ({ meta: [{ title: "Dashboards IA · IARA" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const [persona, setPersona] = useState<Persona>("gestor");
  const [anomesIni, setAnomesIni] = useState<number | "">("");
  const [anomesFim, setAnomesFim] = useState<number | "">("");
  const [idOrgao, setIdOrgao] = useState<number | "">("");
  const [classe, setClasse] = useState<string>("");
  const [grau, setGrau] = useState<string>("");
  const [unidade, setUnidade] = useState<string>("");
  const [compareOn, setCompareOn] = useState(false);
  const [cmpAIni, setCmpAIni] = useState<number | "">("");
  const [cmpAFim, setCmpAFim] = useState<number | "">("");
  const [cmpBIni, setCmpBIni] = useState<number | "">("");
  const [cmpBFim, setCmpBFim] = useState<number | "">("");

  const filters = useMemo(() => ({
    anomesIni: anomesIni || null,
    anomesFim: anomesFim || null,
    idOrgao: idOrgao === "" ? null : idOrgao,
    classe: classe || null,
  }), [anomesIni, anomesFim, idOrgao, classe]);

  const metasFilters = useMemo(() => ({
    grau: grau || null,
    unidade: unidade || null,
  }), [grau, unidade]);

  const metricsFn = useServerFn(getOverviewMetrics);
  const topFn = useServerFn(getTopUnidades);
  const violFn = useServerFn(getViolenciaPorOrgao);
  const optsFn = useServerFn(getFilterOptions);
  const cmpFn = useServerFn(getComparativo);
  const metasFn = useServerFn(getMetasNacionais);
  const unidadesFn = useServerFn(getUnidadesJudiciais);

  const opts = useQuery({ queryKey: ["iara-opts"], queryFn: () => optsFn() });
  const unidades = useQuery({ queryKey: ["iara-unidades"], queryFn: () => unidadesFn() });
  const metrics = useQuery({ queryKey: ["iara-overview", filters], queryFn: () => metricsFn({ data: filters }) });
  const top = useQuery({ queryKey: ["iara-top", filters], queryFn: () => topFn({ data: filters }) });
  const viol = useQuery({ queryKey: ["iara-viol"], queryFn: () => violFn() });
  const metas = useQuery({ queryKey: ["iara-metas", metasFilters], queryFn: () => metasFn({ data: metasFilters }) });

  const cmpReady = compareOn && cmpAIni && cmpAFim && cmpBIni && cmpBFim;
  const cmp = useQuery({
    queryKey: ["iara-cmp", cmpAIni, cmpAFim, cmpBIni, cmpBFim],
    queryFn: () => cmpFn({ data: { a: { ini: Number(cmpAIni), fim: Number(cmpAFim) }, b: { ini: Number(cmpBIni), fim: Number(cmpBFim) } } }),
    enabled: !!cmpReady,
  });

  if (metrics.isLoading) return <Loader />;
  if (metrics.error) return <ErrorBox msg={String(metrics.error)} />;
  const m = metrics.data!;
  const meta1 = metas.data?.meta1;
  const meta2 = metas.data?.meta2;

  function limparFiltros() {
    setAnomesIni(""); setAnomesFim(""); setIdOrgao(""); setClasse(""); setGrau(""); setUnidade("");
  }

  return (
    <div className="iara-page">
      <div className="iara-page-head">
        <div>
          <h1 className="iara-page-title">Dashboards <span>IA</span></h1>
          <p className="iara-page-sub">Painéis executivos com filtros dinâmicos, Metas Nacionais do CNJ e análise comparativa entre períodos.</p>
        </div>
        <div className="iara-persona-tabs">
          {(["magistrado", "gestor", "servidor"] as Persona[]).map((p) => (
            <button key={p} type="button" className={`iara-persona-tab ${persona === p ? "active" : ""}`} onClick={() => setPersona(p)}>
              {p === "magistrado" ? "Magistrado" : p === "gestor" ? "Gestor" : "Servidor"}
            </button>
          ))}
        </div>
      </div>

      <section className="iara-panel">
        <h2 className="iara-panel-title">Filtros executivos <span className="tag">{metrics.isFetching || metas.isFetching ? "atualizando…" : "ativos"}</span></h2>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {PERIODOS_RAPIDOS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`iara-btn-ghost ${anomesIni === p.ini && anomesFim === p.fim ? "active" : ""}`}
              onClick={() => { setAnomesIni(p.ini); setAnomesFim(p.fim); }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <FilterField label="Período inicial (YYYYMM)">
            <input className="iara-input" type="number" placeholder="202401" value={anomesIni} onChange={(e) => setAnomesIni(e.target.value ? Number(e.target.value) : "")} />
          </FilterField>
          <FilterField label="Período final (YYYYMM)">
            <input className="iara-input" type="number" placeholder="202603" value={anomesFim} onChange={(e) => setAnomesFim(e.target.value ? Number(e.target.value) : "")} />
          </FilterField>
          <FilterField label="Grau">
            <select className="iara-input" value={grau} onChange={(e) => setGrau(e.target.value)}>
              <option value="">Todos os graus</option>
              <option value="G1">1º Grau</option>
              <option value="G2">2º Grau</option>
              <option value="JE">Juizado Especial</option>
              <option value="TR">Turma Recursal</option>
            </select>
          </FilterField>
          <FilterField label="Unidade judicial (Metas CNJ)">
            <select className="iara-input" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
              <option value="">Todas as unidades</option>
              {(unidades.data ?? [])
                .filter((u) => !grau || u.grau === grau)
                .map((u) => <option key={u.unidade} value={u.unidade}>{u.unidade}</option>)}
            </select>
          </FilterField>
          <FilterField label="Órgão julgador (TCL)">
            <select className="iara-input" value={idOrgao} onChange={(e) => setIdOrgao(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Todos (global)</option>
              {(opts.data?.orgaos ?? []).map((o) => <option key={o} value={o}>Órgão #{o}</option>)}
            </select>
          </FilterField>
          <FilterField label="Classe processual">
            <select className="iara-input" value={classe} onChange={(e) => setClasse(e.target.value)}>
              <option value="">Todas</option>
              {(opts.data?.classes ?? []).slice(0, 200).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FilterField>
          <button className="iara-btn-ghost" type="button" onClick={limparFiltros}>Limpar</button>
          <button className={`iara-btn-ghost ${compareOn ? "active" : ""}`} type="button" onClick={() => setCompareOn((v) => !v)}>
            {compareOn ? "✓ Comparativo" : "+ Comparativo"}
          </button>
        </div>

        {compareOn && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12, borderTop: "1px dashed rgba(45,212,191,0.2)", paddingTop: 12 }}>
            <FilterField label="Período A · ini"><input className="iara-input" type="number" placeholder="202401" value={cmpAIni} onChange={(e) => setCmpAIni(e.target.value ? Number(e.target.value) : "")} /></FilterField>
            <FilterField label="Período A · fim"><input className="iara-input" type="number" placeholder="202412" value={cmpAFim} onChange={(e) => setCmpAFim(e.target.value ? Number(e.target.value) : "")} /></FilterField>
            <FilterField label="Período B · ini"><input className="iara-input" type="number" placeholder="202501" value={cmpBIni} onChange={(e) => setCmpBIni(e.target.value ? Number(e.target.value) : "")} /></FilterField>
            <FilterField label="Período B · fim"><input className="iara-input" type="number" placeholder="202512" value={cmpBFim} onChange={(e) => setCmpBFim(e.target.value ? Number(e.target.value) : "")} /></FilterField>
          </div>
        )}

        {compareOn && cmp.data && (
          <div className="iara-kpi-row" style={{ marginTop: 14 }}>
            <CmpKpi label="Baixados · A" a={cmp.data.a.baixados} b={cmp.data.b.baixados} />
            <CmpKpi label="Novos · A" a={cmp.data.a.novos} b={cmp.data.b.novos} />
            <CmpKpi label="Pendentes (fim) · A" a={cmp.data.a.pendentesFim} b={cmp.data.b.pendentesFim} invert />
          </div>
        )}
      </section>

      <Section title="Metas Nacionais do CNJ">
        <div className="iara-kpi-row">
          <Kpi
            label="Meta 1 · Julgar ≥ Casos Novos"
            value={meta1?.ultimoAno?.indiceMeta1 != null ? `${meta1.ultimoAno.indiceMeta1}%` : "—"}
            foot={meta1?.ultimoAno ? `${meta1.ultimoAno.ano} · ${meta1.ultimoAno.julgados.toLocaleString("pt-BR")} julgados / ${meta1.ultimoAno.casosNovos.toLocaleString("pt-BR")} novos` : "Sem dados"}
          />
          <Kpi
            label="Meta 1 · status"
            value={meta1?.cumprida ? "Cumprida" : "Em risco"}
            foot="Meta nacional: índice ≥ 100%"
          />
          <Kpi
            label="Meta 2 · Acervo antigo julgado"
            value={meta2?.ultimoAno?.indiceMeta2 != null ? `${meta2.ultimoAno.indiceMeta2}%` : "—"}
            foot={meta2?.ultimoAno ? `${meta2.ultimoAno.ano} · ${meta2.ultimoAno.julgadosAntigos.toLocaleString("pt-BR")} julgados antigos` : "Sem dados"}
          />
          <Kpi
            label="Meta 2 · status"
            value={meta2?.cumprida ? "Cumprida" : "Em risco"}
            foot="Meta nacional de referência: índice ≥ 80%"
          />
        </div>
        <div style={{ height: 260, marginTop: 12 }}>
          <ResponsiveContainer>
            <BarChart data={meta1?.serie.map((s) => ({ ano: `${s.ano}·${s.grau}`, indice: s.indiceMeta1 ?? 0 })) ?? []}>
              <CartesianGrid stroke="rgba(45,212,191,0.08)" />
              <XAxis dataKey="ano" stroke="#5e7a76" fontSize={10} />
              <YAxis stroke="#5e7a76" fontSize={10} />
              <Tooltip contentStyle={{ background: "#08130f", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="indice" name="Índice Meta 1 (%)" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {meta1?.unidades && meta1.unidades.length > 0 && (
          <Table
            headers={["Unidade", "Grau", "Casos novos", "Julgados", "Índice Meta 1"]}
            rows={meta1.unidades.slice(0, 10).map((u) => [u.unidade, u.grau, u.casosNovos.toLocaleString("pt-BR"), u.julgados.toLocaleString("pt-BR"), u.indiceMeta1 != null ? `${u.indiceMeta1}%` : "—"])}
          />
        )}
      </Section>

      {persona === "magistrado" && (
        <>
          <Section title="Decisões críticas do seu gabinete">
            <div className="iara-kpi-row">
              <Kpi label="Pendentes (último mês do filtro)" value={String(m.tcl.pendentes)} foot={`Mês ${m.tcl.ultimoMes ?? "-"}`} />
              <Kpi label="Violência doméstica · média de dias" value={String(m.violencia.mediaDias)} foot={`${m.violencia.validos} processos válidos`} />
              <Kpi label="Ações penais · dias sem tramitação" value={String(m.acoesPenais.mediaDiasSemTramitacao)} foot={classe ? `Classe: ${classe}` : "Risco de prescrição"} />
              <Kpi label="Alertas críticos" value={String(m.alertas.porSeveridade.critica ?? 0)} foot="Decida hoje" />
            </div>
          </Section>
          <Section title="Top processos de violência doméstica por duração">
            <Table headers={["Órgão julgador", "Processos válidos", "Média de dias"]} rows={(viol.data ?? []).slice(0, 8).map((v) => [v.orgao, String(v.processos), String(v.mediaDias)])} />
          </Section>
        </>
      )}

      {persona === "gestor" && (
        <>
          <Section title="Saúde operacional">
            <div className="iara-kpi-row">
              <Kpi label="Baixados (último mês)" value={String(m.tcl.baixados)} foot="Produtividade" />
              <Kpi label="Pendentes (último mês)" value={String(m.tcl.pendentes)} foot="Estoque" />
              <Kpi label="Baixados nos últimos 12m" value={Math.round(m.tcl.baixados12m).toLocaleString("pt-BR")} foot="Tendência anual" />
              <Kpi label="Alertas ativos" value={String(m.alertas.total)} foot="Ação imediata" />
            </div>
          </Section>
          <Section title="Tendência mensal · baixados vs pendentes vs novos">
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={m.tcl.serie}>
                  <CartesianGrid stroke="rgba(45,212,191,0.08)" />
                  <XAxis dataKey="anomes" stroke="#5e7a76" fontSize={10} />
                  <YAxis stroke="#5e7a76" fontSize={10} />
                  <Tooltip contentStyle={{ background: "#08130f", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="baixados" stroke="#2dd4bf" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pendentes" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="novos" stroke="#818cf8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
          <Section title="Top 10 unidades com maior estoque (TCL)">
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={(top.data ?? []).map((t) => ({ unidade: `#${t.id_orgao_julgador}`, pendentes: t.quantidade_pendentes }))}>
                  <CartesianGrid stroke="rgba(45,212,191,0.08)" />
                  <XAxis dataKey="unidade" stroke="#5e7a76" fontSize={10} />
                  <YAxis stroke="#5e7a76" fontSize={10} />
                  <Tooltip contentStyle={{ background: "#08130f", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="pendentes" fill="#818cf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
          <Section title="Meta 2 · acervo antigo por unidade">
            <Table
              headers={["Unidade", "Grau", "Distribuídos", "Julgados"]}
              rows={(meta2?.unidades ?? []).slice(0, 10).map((u) => [u.unidade, u.grau, u.distribuidos.toLocaleString("pt-BR"), u.julgados.toLocaleString("pt-BR")])}
            />
          </Section>
        </>
      )}

      {persona === "servidor" && (
        <>
          <Section title="Sua fila — o que precisa de você">
            <div className="iara-kpi-row">
              <Kpi label="Processos analisados" value={(m.acoesPenais.total + m.violencia.total).toLocaleString("pt-BR")} foot="Base IARA" />
              <Kpi label="Tarefas pendentes (estoque)" value={String(m.tcl.pendentes)} foot="Conhecimento · 1º grau" />
              <Kpi label="Próximo relatório automático" value="Seg · 07h" foot="Entregue automaticamente" />
              <Kpi label="Alertas para revisar" value={String(m.alertas.total)} foot="Priorize críticos primeiro" />
            </div>
          </Section>
          <Section title="Ações práticas">
            <ul style={{ fontSize: 13, color: "var(--iara-text-s)", lineHeight: 1.8 }}>
              <li>🟥 Revise processos com mais de 1000 dias sem tramitação.</li>
              <li>🟧 Priorize processos de violência doméstica acima da média ({m.violencia.mediaDias} dias).</li>
              <li>🟨 Acompanhe a Meta 1 ({meta1?.ultimoAno?.indiceMeta1 ?? "—"}%) e a Meta 2 ({meta2?.ultimoAno?.indiceMeta2 ?? "—"}%) da sua unidade.</li>
              <li>🟦 Use o Chat Analítico para localizar gargalos por unidade.</li>
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--iara-text-s)" }}>
      {label}
      {children}
    </label>
  );
}
function CmpKpi({ label, a, b, invert }: { label: string; a: number; b: number; invert?: boolean }) {
  const diff = b - a;
  const pct = a ? (diff / a) * 100 : 0;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <div className="iara-kpi">
      <div className="iara-kpi-label">{label} → B</div>
      <div className="iara-kpi-value">{a.toLocaleString("pt-BR")} → {b.toLocaleString("pt-BR")}</div>
      <div className="iara-kpi-foot" style={{ color: good ? "#4ade80" : "var(--iara-red-l)" }}>
        {diff >= 0 ? "▲" : "▼"} {Math.abs(diff).toLocaleString("pt-BR")} ({pct.toFixed(1)}%)
      </div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="iara-panel">
      <h2 className="iara-panel-title">{title} <span className="tag">IARA</span></h2>
      {children}
    </section>
  );
}
function Kpi({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <div className="iara-kpi">
      <div className="iara-kpi-label">{label}</div>
      <div className="iara-kpi-value">{value}</div>
      <div className="iara-kpi-foot">{foot}</div>
    </div>
  );
}
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table className="iara-table">
      <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}
function Loader() { return <div className="iara-page"><div className="iara-panel">Carregando dados da IARA…</div></div>; }
function ErrorBox({ msg }: { msg: string }) { return <div className="iara-page"><div className="iara-panel" style={{ color: "var(--iara-red-l)" }}>Erro: {msg}</div></div>; }
