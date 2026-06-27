import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import metasData from "@/data/iara-metas.json";
import unidadesData from "@/data/iara-unidades.json";

type Meta1Serie = { ano: number; grau: string; casosNovos: number; julgados: number; pendentes: number; indiceMeta1: number | null };
type Meta1Unidade = { unidade: string; grau: string; casosNovos: number; julgados: number; indiceMeta1: number | null };
type Meta2Serie = { ano: number; grau: string; distribuidos: number; julgados: number; distribuidosAntigos: number; julgadosAntigos: number; indiceMeta2: number | null };
type Meta2Unidade = { unidade: string; grau: string; distribuidos: number; julgados: number };
type UnidadeJudicial = { unidade: string; grau: string; arquivos: string };

const metas = metasData as {
  meta1Serie: Meta1Serie[];
  meta1Unidades: Meta1Unidade[];
  meta2Serie: Meta2Serie[];
  meta2Unidades: Meta2Unidade[];
};
const unidades = unidadesData as UnidadeJudicial[];

type MetasFilters = { grau?: string | null; unidade?: string | null; anoIni?: number | null; anoFim?: number | null };

/** Indicadores das Metas Nacionais do CNJ (Meta 1 e Meta 2), com filtros executivos por grau/unidade/ano. */
export const getMetasNacionais = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: MetasFilters | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const f = data;
    const inGrau = (g: string) => !f.grau || g === f.grau;
    const inAno = (a: number) => (!f.anoIni || a >= f.anoIni) && (!f.anoFim || a <= f.anoFim);

    const meta1Serie = metas.meta1Serie.filter((r) => inGrau(r.grau) && inAno(r.ano));
    const meta2Serie = metas.meta2Serie.filter((r) => inGrau(r.grau) && inAno(r.ano));
    const meta1Unidades = metas.meta1Unidades.filter((r) => inGrau(r.grau) && (!f.unidade || r.unidade === f.unidade));
    const meta2Unidades = metas.meta2Unidades.filter((r) => inGrau(r.grau) && (!f.unidade || r.unidade === f.unidade));

    const lastM1 = meta1Serie.at(-1);
    const lastM2 = meta2Serie.at(-1);
    const m1Cumprida = (lastM1?.indiceMeta1 ?? 0) >= 100;
    const m2Cumprida = (lastM2?.indiceMeta2 ?? 0) >= 80;

    return {
      meta1: { serie: meta1Serie, unidades: meta1Unidades.slice(0, 20), ultimoAno: lastM1 ?? null, cumprida: m1Cumprida },
      meta2: { serie: meta2Serie, unidades: meta2Unidades.slice(0, 20), ultimoAno: lastM2 ?? null, cumprida: m2Cumprida },
    };
  });

/** Catálogo executivo de unidades judiciais (varas, turmas, juizados) para filtros. */
export const getUnidadesJudiciais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return unidades
      .filter((u) => u.unidade)
      .map((u) => ({ unidade: u.unidade, grau: u.grau, arquivos: Number(u.arquivos) || 0 }))
      .sort((a, b) => a.unidade.localeCompare(b.unidade));
  });

type Filters = {
  anomesIni?: number | null;
  anomesFim?: number | null;
  idOrgao?: number | null;
  classe?: string | null;
};

function applyTclFilters(q: any, f: Filters) {
  if (f.anomesIni) q = q.gte("anomes", f.anomesIni);
  if (f.anomesFim) q = q.lte("anomes", f.anomesFim);
  if (f.idOrgao != null) q = q.eq("id_orgao_julgador", f.idOrgao);
  return q;
}

function aggregateTcl(rows: any[]) {
  const map = new Map<number, { anomes: number; baixados: number; pendentes: number; novos: number; baixados12m: number }>();
  for (const r of rows ?? []) {
    const k = r.anomes;
    const cur = map.get(k) ?? { anomes: k, baixados: 0, pendentes: 0, novos: 0, baixados12m: 0 };
    cur.baixados += Number(r.quantidade_baixados ?? 0);
    cur.pendentes += Number(r.quantidade_pendentes ?? 0);
    cur.novos += Number(r.quantidade_novos ?? 0);
    cur.baixados12m += Number(r.quantidade_baixados_12m ?? 0);
    map.set(k, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.anomes - b.anomes);
}

/** Métricas globais (com filtros opcionais) */
export const getOverviewMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const f = data;

    let tclQ = supabase
      .from("iara_tcl_monthly")
      .select("anomes,quantidade_baixados,quantidade_pendentes,quantidade_baixados_12m,quantidade_novos,id_orgao_julgador");
    tclQ = f.idOrgao != null ? tclQ.eq("id_orgao_julgador", f.idOrgao) : tclQ.eq("id_orgao_julgador", -1);
    if (f.anomesIni) tclQ = tclQ.gte("anomes", f.anomesIni);
    if (f.anomesFim) tclQ = tclQ.lte("anomes", f.anomesFim);
    tclQ = tclQ.order("anomes");

    let apQ = supabase.from("iara_acoes_penais").select("dias_sem_tramitacao,orgao_julgador,classe");
    if (f.classe) apQ = apQ.eq("classe", f.classe);

    const [tcl, viol, ap, alerts, sources] = await Promise.all([
      tclQ,
      supabase.from("iara_violencia").select("dias,valido"),
      apQ,
      supabase.from("iara_alertas").select("severidade,ativo").eq("ativo", true),
      supabase.from("iara_data_sources").select("nome,status"),
    ]);

    const serie = aggregateTcl(tcl.data ?? []);
    const last = serie.at(-1);
    const violRows = (viol.data ?? []).filter((v) => v.valido && (v.dias ?? 0) > 0);
    const avgViol = violRows.length ? violRows.reduce((s, v) => s + (v.dias ?? 0), 0) / violRows.length : 0;
    const apRows = (ap.data ?? []).filter((a) => a.dias_sem_tramitacao);
    const avgParada = apRows.length ? apRows.reduce((s, a) => s + Number(a.dias_sem_tramitacao ?? 0), 0) / apRows.length : 0;
    const alertCounts = (alerts.data ?? []).reduce<Record<string, number>>((acc, a) => {
      acc[a.severidade] = (acc[a.severidade] ?? 0) + 1; return acc;
    }, {});

    return {
      tcl: {
        ultimoMes: last?.anomes ?? null,
        baixados: last?.baixados ?? 0,
        pendentes: last?.pendentes ?? 0,
        baixados12m: Number(last?.baixados12m ?? 0),
        serie: serie.map((s) => ({ anomes: s.anomes, baixados: s.baixados, pendentes: s.pendentes, novos: s.novos })),
      },
      violencia: { total: viol.data?.length ?? 0, validos: violRows.length, mediaDias: Math.round(avgViol) },
      acoesPenais: { total: ap.data?.length ?? 0, mediaDiasSemTramitacao: Math.round(avgParada) },
      alertas: { total: alerts.data?.length ?? 0, porSeveridade: alertCounts },
      fontes: sources.data ?? [],
    };
  });

/** Top órgãos com maior estoque pendente */
export const getTopUnidades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("iara_tcl_monthly")
      .select("id_orgao_julgador,quantidade_pendentes,quantidade_baixados,anomes")
      .neq("id_orgao_julgador", -1);
    if (data.anomesIni) q = q.gte("anomes", data.anomesIni);
    if (data.anomesFim) q = q.lte("anomes", data.anomesFim);
    const { data: rows } = await q.order("anomes", { ascending: false }).limit(5000);
    const lastByUnit = new Map<number, { id_orgao_julgador: number; quantidade_pendentes: number; quantidade_baixados: number; anomes: number }>();
    for (const row of rows ?? []) {
      const cur = lastByUnit.get(row.id_orgao_julgador);
      if (!cur || row.anomes > cur.anomes) {
        lastByUnit.set(row.id_orgao_julgador, { ...row, quantidade_pendentes: row.quantidade_pendentes ?? 0 });
      } else if (row.anomes === cur.anomes) {
        cur.quantidade_pendentes += row.quantidade_pendentes ?? 0;
        cur.quantidade_baixados += row.quantidade_baixados ?? 0;
      }
    }
    return Array.from(lastByUnit.values())
      .sort((a, b) => b.quantidade_pendentes - a.quantidade_pendentes)
      .slice(0, 10);
  });

/** Listas para filtros */
export const getFilterOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [orgaos, classes] = await Promise.all([
      context.supabase.from("iara_tcl_monthly").select("id_orgao_julgador").neq("id_orgao_julgador", -1).limit(2000),
      context.supabase.from("iara_acoes_penais").select("classe").not("classe", "is", null).limit(5000),
    ]);
    const orgaoIds = Array.from(new Set((orgaos.data ?? []).map((r) => r.id_orgao_julgador))).sort((a, b) => a - b);
    const classeNames = Array.from(new Set((classes.data ?? []).map((r) => r.classe).filter(Boolean))).sort() as string[];
    return { orgaos: orgaoIds, classes: classeNames };
  });

/** Comparativo entre dois períodos */
export const getComparativo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { a: { ini: number; fim: number }; b: { ini: number; fim: number } }) => d)
  .handler(async ({ data, context }) => {
    const fetchAgg = async (ini: number, fim: number) => {
      const { data: rows } = await context.supabase
        .from("iara_tcl_monthly")
        .select("anomes,quantidade_baixados,quantidade_pendentes,quantidade_novos")
        .eq("id_orgao_julgador", -1)
        .gte("anomes", ini)
        .lte("anomes", fim);
      const agg = aggregateTcl(rows ?? []);
      const sumBaix = agg.reduce((s, r) => s + r.baixados, 0);
      const sumNov = agg.reduce((s, r) => s + r.novos, 0);
      const lastPend = agg.at(-1)?.pendentes ?? 0;
      return { baixados: sumBaix, novos: sumNov, pendentesFim: lastPend, meses: agg.length };
    };
    const [a, b] = await Promise.all([fetchAgg(data.a.ini, data.a.fim), fetchAgg(data.b.ini, data.b.fim)]);
    return { a, b };
  });

function olsForecast(serie: { x: number; pendentes: number; anomes: number }[], horizon: number) {
  const n = serie.length;
  const sx = serie.reduce((s, p) => s + p.x, 0);
  const sy = serie.reduce((s, p) => s + p.pendentes, 0);
  const sxy = serie.reduce((s, p) => s + p.x * p.pendentes, 0);
  const sxx = serie.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const intercept = (sy - slope * sx) / n;
  const ymean = sy / n;
  const ssTot = serie.reduce((s, p) => s + (p.pendentes - ymean) ** 2, 0);
  const ssRes = serie.reduce((s, p) => s + (p.pendentes - (intercept + slope * p.x)) ** 2, 0);
  const r2 = ssTot ? 1 - ssRes / ssTot : 0;
  const lastAnomes = serie[serie.length - 1].anomes;
  const addMonths = (anomes: number, k: number) => {
    const y = Math.floor(anomes / 100), m = anomes % 100;
    const total = y * 12 + (m - 1) + k;
    return Math.floor(total / 12) * 100 + ((total % 12) + 1);
  };
  const forecast = Array.from({ length: horizon }, (_, i) => {
    const x = n + i;
    return { x, anomes: addMonths(lastAnomes, i + 1), pendentes: Math.max(0, Math.round(intercept + slope * x)) };
  });
  return { slope: Number(slope.toFixed(2)), intercept: Math.round(intercept), r2: Number(r2.toFixed(3)), forecast };
}

/** Motor Preditivo: Gemini gera previsão numérica de N meses + narrativa. OLS como fallback. */
export const getPredictive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { horizon?: number } | undefined) => ({ horizon: d?.horizon ?? 12 }))
  .handler(async ({ data, context }) => {
    const horizon = Math.min(Math.max(data.horizon ?? 12, 3), 18);
    const { data: rows } = await context.supabase
      .from("iara_tcl_monthly")
      .select("anomes,quantidade_pendentes,quantidade_baixados,quantidade_novos")
      .eq("id_orgao_julgador", -1)
      .order("anomes");
    const agg = aggregateTcl(rows ?? []);
    const serie = agg.map((r, i) => ({ x: i, anomes: r.anomes, pendentes: r.pendentes, baixados: r.baixados, novos: r.novos }));
    if (serie.length < 3) {
      return { serie, forecast: [], slope: 0, intercept: 0, r2: 0, model: "n/a", narrativa: "Série insuficiente para previsão." };
    }

    const ols = olsForecast(serie, horizon);

    const meta1Ultimo = metas.meta1Serie.at(-1) ?? null;
    const meta2Ultimo = metas.meta2Serie.at(-1) ?? null;

    // Tenta Gemini para previsão numérica + narrativa
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { serie, forecast: ols.forecast, slope: ols.slope, intercept: ols.intercept, r2: ols.r2, model: "OLS (fallback — sem LOVABLE_API_KEY)", narrativa: "", meta1Ultimo, meta2Ultimo };
    }

    const prompt = `Você é um analista de séries temporais judiciais do TJAC.
Dada a série mensal abaixo (anomes no formato YYYYMM, pendentes/baixados/novos), gere uma PREVISÃO NUMÉRICA dos próximos ${horizon} meses para "pendentes".

Série histórica (${serie.length} pontos):
${JSON.stringify(serie.map((s) => ({ anomes: s.anomes, pendentes: s.pendentes, baixados: s.baixados, novos: s.novos })))}

Como referência, a regressão OLS estimou: slope=${ols.slope}, R²=${ols.r2}, previsão linear=${JSON.stringify(ols.forecast)}.

Contexto das Metas Nacionais do CNJ (use para qualificar a recomendação, não para prever números):
- Meta 1 (julgar ≥ casos novos), último ano apurado: ${JSON.stringify(meta1Ultimo)}
- Meta 2 (julgar acervo antigo), último ano apurado: ${JSON.stringify(meta2Ultimo)}

Responda EXCLUSIVAMENTE com JSON válido neste formato (sem markdown, sem comentários):
{
  "forecast": [{"anomes": 202604, "pendentes": 1234}, ...${horizon} itens],
  "metodo": "string curto (ex.: 'tendência+sazonalidade')",
  "confianca": "alta|media|baixa",
  "narrativa": "2-4 frases explicando a previsão, fatores, e o impacto esperado nas Metas 1 e 2 do CNJ"
}`;

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "google/gemini-3.1-pro-preview",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (!resp.ok) throw new Error(`gateway ${resp.status}`);
      const json = await resp.json() as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(text) as { forecast?: { anomes: number; pendentes: number }[]; metodo?: string; confianca?: string; narrativa?: string };
      const fc = (parsed.forecast ?? []).slice(0, horizon).map((p) => ({
        anomes: Number(p.anomes),
        pendentes: Math.max(0, Math.round(Number(p.pendentes))),
      }));
      if (fc.length < 1) throw new Error("forecast vazio");
      return {
        serie,
        forecast: fc,
        slope: ols.slope,
        intercept: ols.intercept,
        r2: ols.r2,
        model: `Gemini 3.1 Pro · ${parsed.metodo ?? "previsão"} · confiança ${parsed.confianca ?? "—"}`,
        narrativa: parsed.narrativa ?? "",
        meta1Ultimo,
        meta2Ultimo,
      };
    } catch (e) {
      return { serie, forecast: ols.forecast, slope: ols.slope, intercept: ols.intercept, r2: ols.r2, model: `OLS (fallback — Gemini falhou: ${String(e).slice(0, 80)})`, narrativa: "", meta1Ultimo, meta2Ultimo };
    }
  });

export const getAlertas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("iara_alertas").select("*").eq("ativo", true).order("severidade", { ascending: false }).order("criado_em", { ascending: false });
    return data ?? [];
  });

export const getDataSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("iara_data_sources").select("*").order("nome");
    return data ?? [];
  });

export const getViolenciaPorOrgao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("iara_violencia").select("orgao_julgador,dias,valido");
    const map = new Map<string, { total: number; soma: number; n: number }>();
    for (const r of data ?? []) {
      if (!r.valido || !r.dias || r.dias <= 0) continue;
      const k = r.orgao_julgador ?? "—";
      const v = map.get(k) ?? { total: 0, soma: 0, n: 0 };
      v.total += 1; v.soma += r.dias; v.n += 1;
      map.set(k, v);
    }
    return Array.from(map.entries())
      .map(([orgao, v]) => ({ orgao, processos: v.total, mediaDias: Math.round(v.soma / v.n) }))
      .sort((a, b) => b.mediaDias - a.mediaDias)
      .slice(0, 15);
  });

type RelatorioInput = { persona: "magistrado" | "gestor" | "servidor"; anomesIni?: number | null; anomesFim?: number | null; grau?: string | null; unidade?: string | null };

/** Relatório analítico executivo: combina TCL, violência, ações penais, alertas e Metas Nacionais (1 e 2),
 *  com narrativa gerada por IA quando LOVABLE_API_KEY estiver configurada. */
export const getRelatorioExecutivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: RelatorioInput) => d)
  .handler(async ({ data, context }) => {
    const f = data;
    const overview = await getOverviewMetrics({ data: { anomesIni: f.anomesIni, anomesFim: f.anomesFim } });

    const inGrau = (g: string) => !f.grau || g === f.grau;
    const meta1Serie = metas.meta1Serie.filter((r) => inGrau(r.grau));
    const meta2Serie = metas.meta2Serie.filter((r) => inGrau(r.grau));
    const meta1Unidade = f.unidade ? metas.meta1Unidades.find((u) => u.unidade === f.unidade && inGrau(u.grau)) : null;
    const meta2Unidade = f.unidade ? metas.meta2Unidades.find((u) => u.unidade === f.unidade && inGrau(u.grau)) : null;

    const { data: alertas } = await context.supabase.from("iara_alertas").select("titulo,mensagem,severidade,unidade").eq("ativo", true).order("severidade", { ascending: false }).limit(8);

    const resumo = {
      periodo: { ini: f.anomesIni ?? null, fim: f.anomesFim ?? null },
      persona: f.persona,
      grau: f.grau ?? null,
      unidade: f.unidade ?? null,
      tcl: overview.tcl,
      violencia: overview.violencia,
      acoesPenais: overview.acoesPenais,
      alertas: alertas ?? [],
      meta1: { serie: meta1Serie.slice(-6), unidade: meta1Unidade },
      meta2: { serie: meta2Serie.slice(-6), unidade: meta2Unidade },
    };

    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { ...resumo, narrativa: "", model: "sem narrativa IA (LOVABLE_API_KEY ausente)" };
    }

    const prompt = `Você é a IARA, analista de dados do TJAC. Gere um RELATÓRIO ANALÍTICO EXECUTIVO em português, voltado para a persona "${f.persona}", com base nos dados reais abaixo (não invente números):

${JSON.stringify(resumo)}

Formato: título curto, 3-6 bullets com os achados mais relevantes (use negrito nos números), uma seção "Riscos e recomendações" e referência explícita ao cumprimento da Meta 1 e Meta 2 do CNJ. Máximo 220 palavras.`;

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "google/gemini-3.1-pro-preview", messages: [{ role: "user", content: prompt }] }),
      });
      if (!resp.ok) throw new Error(`gateway ${resp.status}`);
      const json = await resp.json() as { choices?: { message?: { content?: string } }[] };
      const narrativa = json.choices?.[0]?.message?.content ?? "";
      return { ...resumo, narrativa, model: "Gemini 3.1 Pro" };
    } catch (e) {
      return { ...resumo, narrativa: "", model: `IA indisponível: ${String(e).slice(0, 80)}` };
    }
  });
