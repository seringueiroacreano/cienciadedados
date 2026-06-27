import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getRelatorioExecutivo, getUnidadesJudiciais } from "@/lib/iara.functions";

type Persona = "magistrado" | "gestor" | "servidor";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios Analíticos · IARA" }] }),
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const [persona, setPersona] = useState<Persona>("gestor");
  const [anomesIni, setAnomesIni] = useState<number | "">("");
  const [anomesFim, setAnomesFim] = useState<number | "">("");
  const [grau, setGrau] = useState<string>("");
  const [unidade, setUnidade] = useState<string>("");

  const unidadesFn = useServerFn(getUnidadesJudiciais);
  const unidades = useQuery({ queryKey: ["iara-unidades"], queryFn: () => unidadesFn() });

  const relatorioFn = useServerFn(getRelatorioExecutivo);
  const mutation = useMutation({
    mutationFn: () => relatorioFn({
      data: {
        persona,
        anomesIni: anomesIni || null,
        anomesFim: anomesFim || null,
        grau: grau || null,
        unidade: unidade || null,
      },
    }),
  });

  return (
    <div className="iara-page">
      <div className="iara-page-head">
        <div>
          <h1 className="iara-page-title">Relatórios <span>Analíticos</span></h1>
          <p className="iara-page-sub">Gere relatórios executivos sob demanda combinando TCL, violência doméstica, ações penais, alertas e Metas Nacionais do CNJ (Meta 1 e Meta 2).</p>
        </div>
        <span className="iara-status-badge iara-status-agendado">Sob demanda + agendado seg · 07h</span>
      </div>

      <section className="iara-panel">
        <h2 className="iara-panel-title">Parâmetros do relatório <span className="tag">Executivo</span></h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <FilterField label="Persona">
            <select className="iara-input" value={persona} onChange={(e) => setPersona(e.target.value as Persona)}>
              <option value="magistrado">Magistrado</option>
              <option value="gestor">Gestor</option>
              <option value="servidor">Servidor</option>
            </select>
          </FilterField>
          <FilterField label="Período inicial (YYYYMM)">
            <input className="iara-input" type="number" placeholder="202401" value={anomesIni} onChange={(e) => setAnomesIni(e.target.value ? Number(e.target.value) : "")} />
          </FilterField>
          <FilterField label="Período final (YYYYMM)">
            <input className="iara-input" type="number" placeholder="202603" value={anomesFim} onChange={(e) => setAnomesFim(e.target.value ? Number(e.target.value) : "")} />
          </FilterField>
          <FilterField label="Grau">
            <select className="iara-input" value={grau} onChange={(e) => setGrau(e.target.value)}>
              <option value="">Todos</option>
              <option value="G1">1º Grau</option>
              <option value="G2">2º Grau</option>
              <option value="JE">Juizado Especial</option>
              <option value="TR">Turma Recursal</option>
            </select>
          </FilterField>
          <FilterField label="Unidade judicial">
            <select className="iara-input" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
              <option value="">Todas</option>
              {(unidades.data ?? []).filter((u) => !grau || u.grau === grau).map((u) => <option key={u.unidade} value={u.unidade}>{u.unidade}</option>)}
            </select>
          </FilterField>
          <button className="iara-btn" type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Gerando…" : "Gerar relatório"}
          </button>
          {mutation.data && (
            <button className="iara-btn-ghost" type="button" onClick={() => window.print()}>Imprimir / PDF</button>
          )}
        </div>
      </section>

      {mutation.isError && (
        <section className="iara-panel" style={{ color: "var(--iara-red-l)" }}>Erro ao gerar relatório: {String(mutation.error)}</section>
      )}

      {mutation.data && (
        <>
          <section className="iara-panel">
            <h2 className="iara-panel-title">Resumo executivo <span className="tag">{mutation.data.model}</span></h2>
            {mutation.data.narrativa ? (
              <p style={{ fontSize: 13, color: "var(--iara-text-s)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{mutation.data.narrativa}</p>
            ) : (
              <p style={{ fontSize: 13, color: "var(--iara-text-s)" }}>Narrativa de IA indisponível — exibindo apenas os indicadores numéricos abaixo.</p>
            )}
          </section>

          <section className="iara-panel">
            <h2 className="iara-panel-title">Indicadores operacionais (TCL)</h2>
            <div className="iara-kpi-row">
              <Kpi label="Baixados" value={String(mutation.data.tcl.baixados)} foot={`Mês ${mutation.data.tcl.ultimoMes ?? "-"}`} />
              <Kpi label="Pendentes" value={String(mutation.data.tcl.pendentes)} foot="Estoque" />
              <Kpi label="Violência doméstica · média dias" value={String(mutation.data.violencia.mediaDias)} foot={`${mutation.data.violencia.validos} válidos`} />
              <Kpi label="Ações penais · dias parado" value={String(mutation.data.acoesPenais.mediaDiasSemTramitacao)} foot="Risco de prescrição" />
            </div>
          </section>

          <section className="iara-panel">
            <h2 className="iara-panel-title">Metas Nacionais do CNJ</h2>
            <Table
              headers={["Ano", "Grau", "Casos novos", "Julgados", "Índice Meta 1"]}
              rows={mutation.data.meta1.serie.map((s: any) => [String(s.ano), s.grau, s.casosNovos.toLocaleString("pt-BR"), s.julgados.toLocaleString("pt-BR"), s.indiceMeta1 != null ? `${s.indiceMeta1}%` : "—"])}
            />
            <div style={{ height: 12 }} />
            <Table
              headers={["Ano", "Grau", "Distribuídos antigos", "Julgados antigos", "Índice Meta 2"]}
              rows={mutation.data.meta2.serie.map((s: any) => [String(s.ano), s.grau, s.distribuidosAntigos.toLocaleString("pt-BR"), s.julgadosAntigos.toLocaleString("pt-BR"), s.indiceMeta2 != null ? `${s.indiceMeta2}%` : "—"])}
            />
          </section>

          {mutation.data.alertas.length > 0 && (
            <section className="iara-panel">
              <h2 className="iara-panel-title">Alertas ativos</h2>
              <Table headers={["Título", "Severidade", "Unidade"]} rows={mutation.data.alertas.map((a: any) => [a.titulo, a.severidade, a.unidade ?? "—"])} />
            </section>
          )}
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
