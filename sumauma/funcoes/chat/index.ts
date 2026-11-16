// Assistente do Sumaúma: o Claude responde consultando o banco, nunca calculando por conta própria.
// Só atende quem está logado e tem perfil. A chave da Anthropic fica no segredo ANTHROPIC_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const MODELO = "claude-opus-5-5";
const LIMITE_DIARIO = 40;      // perguntas por pessoa por dia
const MAX_RODADAS = 6;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SISTEMA = `Você é o assistente do Sumaúma, sistema interno do TJAC para acompanhar as Metas Nacionais do Poder Judiciário (CNJ, 2026).
Regras:
- Responda em português do Brasil, de forma direta, para magistrados e gestores de unidade.
- Todo número vem das ferramentas. Nunca estime, arredonde de cabeça ou invente dado. Se a ferramenta não trouxe, diga que não há o dado.
- Sempre informe a data da base usada.
- O resultado por unidade é referência de gestão: a meta oficial é do tribunal e é apurada pelo CNJ.
- A previsão da Meta 1 é estatística (ritmo recente por dia útil), com margem medida em teste contra o passado. Cite a margem ao falar de previsão.
- Não revele dados pessoais nem comente o mérito de processos. Você pode listar números de processo da fila de trabalho.
Fórmulas: Meta 1 = julgados ÷ (casos novos + dessobrestados − suspensos). Metas 2, 4, 6, 7, 8 e 10 = julgados ÷ (distribuídos − suspensos) ÷ percentual exigido; "a julgar" é o distribuído não julgado nem suspenso. Meta 3 = índice de conciliação (acordos ÷ sentenças), cumpre com 1 ponto acima do ano anterior ou 18%. Meta 5 = taxa de congestionamento líquida (pendentes ÷ (pendentes + baixados)), cumpre com 0,5 ponto abaixo do ano anterior ou até 52%.`;

const FERRAMENTAS = [
  { name: "buscar_unidades", description: "Procura unidades judiciárias pelo nome (trecho, sem acento obrigatório). Use antes das outras ferramentas quando o usuário citar uma unidade.",
    input_schema: { type: "object", properties: { termo: { type: "string" } }, required: ["termo"] } },
  { name: "indicadores", description: "Indicadores do dia mais recente. Com unidade: todas as metas (ou uma) daquela unidade. Sem unidade: totais do tribunal por recorte e as unidades com mais julgamentos faltando na meta informada.",
    input_schema: { type: "object", properties: { meta: { type: "integer", description: "1 a 8 ou 10" }, unidade: { type: "string", description: "nome exato da unidade" } } } },
  { name: "previsao_meta1", description: "Previsão de cumprimento da Meta 1 em 19/12. Com unidade: a projeção dela. Sem unidade: tribunal, contagem por situação e as unidades da situação pedida.",
    input_schema: { type: "object", properties: { unidade: { type: "string" }, situacao: { type: "string", enum: ["Tende a cumprir", "Em risco", "Tende a não cumprir"] } } } },
  { name: "fila_trabalho", description: "Processos a julgar (ou suspensos) de uma unidade em uma meta, do mais antigo para o mais novo.",
    input_schema: { type: "object", properties: { unidade: { type: "string" }, meta: { type: "integer" }, situacao: { type: "string", enum: ["A julgar", "Suspenso", "Pendente"] }, limite: { type: "integer" } }, required: ["unidade", "meta"] } },
];

// deno-lint-ignore no-explicit-any
type Banco = any;

async function idDaUnidade(db: Banco, nome: string) {
  const { data } = await db.from("unidades").select("id,nome").eq("nome", nome).maybeSingle();
  return data?.id ?? null;
}
async function ultimaData(db: Banco, tabela: string) {
  const { data } = await db.from(tabela).select("data_base").order("data_base", { ascending: false }).limit(1);
  return data?.[0]?.data_base ?? null;
}
function situacaoDe(c: number | null, min: number | null, max: number | null) {
  if (c == null) return "Sem base de cálculo";
  if (min == null || max == null) return "Sem margem medida";
  return min >= 100 ? "Tende a cumprir" : max < 100 ? "Tende a não cumprir" : "Em risco";
}

// deno-lint-ignore no-explicit-any
async function executar(db: Banco, nome: string, e: any): Promise<unknown> {
  if (nome === "buscar_unidades") {
    const termo = String(e.termo ?? "").trim().split(/\s+/).join("%");
    const { data } = await db.from("unidades").select("nome,municipio").ilike("nome", `%${termo}%`).limit(25);
    return { unidades: data ?? [] };
  }
  if (nome === "indicadores") {
    const dia = await ultimaData(db, "indicadores_diarios");
    if (!dia) return { erro: "Ainda não há carga no banco." };
    const colunas = "meta,recorte,percentual_exigido,distribuidos,suspensos,fora_computo,julgados,a_julgar,cumprimento,faltam,detalhes,unidades(nome)";
    if (e.unidade) {
      const id = await idDaUnidade(db, e.unidade);
      if (!id) return { erro: "Unidade não encontrada. Use buscar_unidades." };
      let q = db.from("indicadores_diarios").select(colunas).eq("data_base", dia).eq("unidade_id", id);
      if (e.meta) q = q.eq("meta", e.meta);
      const { data } = await q.order("meta");
      return { data_base: dia, unidade: e.unidade, indicadores: data ?? [] };
    }
    if (!e.meta) return { erro: "Informe a meta ou a unidade." };
    // deno-lint-ignore no-explicit-any
    const linhas: any[] = [];
    for (let i = 0; ; i += 1000) {
      const { data } = await db.from("indicadores_diarios").select(colunas).eq("data_base", dia).eq("meta", e.meta).range(i, i + 999);
      linhas.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const totais: Record<string, Record<string, number>> = {};
    for (const l of linhas) {
      const t = (totais[l.recorte] ??= { unidades: 0, distribuidos: 0, suspensos: 0, fora_computo: 0, julgados: 0, a_julgar: 0 });
      t.unidades++; for (const k of ["distribuidos", "suspensos", "fora_computo", "julgados", "a_julgar"]) t[k] += l[k];
    }
    const criticas = linhas.filter((l) => l.faltam > 0).sort((a, b) => b.faltam - a.faltam).slice(0, 25)
      .map((l) => ({ unidade: l.unidades?.nome, recorte: l.recorte, cumprimento: l.cumprimento, faltam: l.faltam, a_julgar: l.a_julgar }));
    return { data_base: dia, meta: e.meta, observacao: "Nos totais, some os campos; para Metas 3 e 5, 'distribuidos' são sentenças e 'julgados' são acordos (Meta 3) ou baixados (Meta 5), e 'a_julgar' na Meta 5 é o acervo pendente.", totais_por_recorte: totais, unidades_com_mais_julgamentos_faltando: criticas };
  }
  if (nome === "previsao_meta1") {
    const dia = await ultimaData(db, "previsoes");
    if (!dia) return { erro: "Ainda não há previsão no banco." };
    // deno-lint-ignore no-explicit-any
    const linhas: any[] = [];
    for (let i = 0; ; i += 1000) {
      const { data } = await db.from("previsoes").select("unidade_id,variavel,valor,limite_inferior,limite_superior,erro_backtest,modelo,unidades(nome)").eq("data_base", dia).eq("meta", 1).range(i, i + 999);
      linhas.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    // deno-lint-ignore no-explicit-any
    const porUnidade = new Map<string, any>();
    for (const l of linhas) {
      const chave = l.unidade_id == null ? "TRIBUNAL" : l.unidades?.nome ?? String(l.unidade_id);
      const u = porUnidade.get(chave) ?? { unidade: chave, margem_pontos: l.erro_backtest };
      if (l.variavel === "cumprimento_projetado") { u.cumprimento_projetado = l.valor; u.minimo = l.limite_inferior; u.maximo = l.limite_superior; }
      else u[l.variavel] = l.valor;
      porUnidade.set(chave, u);
    }
    for (const u of porUnidade.values()) u.situacao = situacaoDe(u.cumprimento_projetado ?? null, u.minimo ?? null, u.maximo ?? null);
    const modelo = linhas[0]?.modelo;
    if (e.unidade) return { data_base: dia, fim_do_periodo: "19/12", modelo, previsao: porUnidade.get(e.unidade) ?? { erro: "Unidade sem previsão. Use buscar_unidades para conferir o nome." } };
    const unidades = [...porUnidade.values()].filter((u) => u.unidade !== "TRIBUNAL");
    const contagem: Record<string, number> = {};
    for (const u of unidades) contagem[u.situacao] = (contagem[u.situacao] ?? 0) + 1;
    const lista = unidades.filter((u) => !e.situacao || u.situacao === e.situacao)
      .sort((a, b) => (b.ritmo_necessario_semana - b.ritmo_atual_semana) - (a.ritmo_necessario_semana - a.ritmo_atual_semana)).slice(0, 30);
    return { data_base: dia, fim_do_periodo: "19/12", modelo, tribunal: porUnidade.get("TRIBUNAL"), unidades_por_situacao: contagem, unidades: lista };
  }
  if (nome === "fila_trabalho") {
    const id = await idDaUnidade(db, e.unidade);
    if (!id) return { erro: "Unidade não encontrada. Use buscar_unidades." };
    const limite = Math.min(Math.max(Number(e.limite) || 20, 1), 50);
    const situacao = e.situacao ?? (e.meta === 5 ? "Pendente" : "A julgar");
    const { data, count } = await db.from("fila_trabalho").select("processo,recorte,origem,distribuido_em,classe,sistema,data_base", { count: "exact" })
      .eq("unidade_id", id).eq("meta", e.meta).eq("situacao", situacao).order("distribuido_em", { ascending: true, nullsFirst: false }).order("processo").limit(limite);
    return { unidade: e.unidade, meta: e.meta, situacao, total: count ?? 0, mostrando: data?.length ?? 0, processos: data ?? [] };
  }
  return { erro: "Ferramenta desconhecida." };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  const url = Deno.env.get("SUPABASE_URL")!, autorizacao = req.headers.get("Authorization") ?? "";
  const db = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: autorizacao } } });
  const { data: { user } } = await db.auth.getUser();
  if (!user) return json({ erro: "Faça login para usar o assistente." }, 401);
  const { data: perfil } = await db.from("perfis").select("papel").eq("id", user.id).maybeSingle();
  if (!perfil) return json({ erro: "Sua conta não tem acesso." }, 403);
  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) return json({ erro: "O assistente ainda não foi configurado: falta a chave da Anthropic.", codigo: "sem_chave" }, 503);

  let corpo: { pergunta?: string; conversa_id?: string };
  try { corpo = await req.json(); } catch { return json({ erro: "Corpo inválido." }, 400); }
  const pergunta = String(corpo.pergunta ?? "").trim().slice(0, 2000);
  if (!pergunta) return json({ erro: "Escreva uma pergunta." }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const hoje = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10) + "T05:00:00Z";   // dia no horário do Acre
  const { data: minhas } = await admin.from("conversas").select("id").eq("usuario_id", user.id);
  const ids = (minhas ?? []).map((c: { id: string }) => c.id);
  if (ids.length) {
    const { count } = await admin.from("mensagens").select("id", { count: "exact", head: true }).in("conversa_id", ids).eq("papel", "usuario").gte("criada_em", hoje);
    if ((count ?? 0) >= LIMITE_DIARIO) return json({ erro: `Limite de ${LIMITE_DIARIO} perguntas por dia atingido. Volte amanhã.` }, 429);
  }

  let conversaId = corpo.conversa_id && ids.includes(corpo.conversa_id) ? corpo.conversa_id : null;
  // deno-lint-ignore no-explicit-any
  const mensagens: any[] = [];
  if (conversaId) {
    const { data: anteriores } = await admin.from("mensagens").select("papel,conteudo").eq("conversa_id", conversaId).order("criada_em").limit(20);
    for (const m of anteriores ?? []) mensagens.push({ role: m.papel === "usuario" ? "user" : "assistant", content: m.conteudo });
  } else {
    const { data: nova, error } = await admin.from("conversas").insert({ usuario_id: user.id, titulo: pergunta.slice(0, 80) }).select("id").single();
    if (error) return json({ erro: "Não foi possível abrir a conversa." }, 500);
    conversaId = nova.id;
  }
  mensagens.push({ role: "user", content: pergunta });
  await admin.from("mensagens").insert({ conversa_id: conversaId, papel: "usuario", conteudo: pergunta });

  let resposta = "";
  for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODELO, max_tokens: 1500, system: SISTEMA, tools: FERRAMENTAS, messages: mensagens }),
    });
    if (!r.ok) {
      console.error("anthropic", r.status, (await r.text()).slice(0, 300));
      return json({ erro: "O assistente está indisponível agora. Tente de novo em instantes.", conversa_id: conversaId }, 502);
    }
    const m = await r.json();
    mensagens.push({ role: "assistant", content: m.content });
    // deno-lint-ignore no-explicit-any
    const usos = (m.content ?? []).filter((b: any) => b.type === "tool_use");
    if (m.stop_reason !== "tool_use" || !usos.length) {
      // deno-lint-ignore no-explicit-any
      resposta = (m.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
      break;
    }
    const resultados = [];
    for (const u of usos) {
      let saida: unknown;
      try { saida = await executar(db, u.name, u.input ?? {}); } catch (e) { saida = { erro: String(e).slice(0, 200) }; }
      resultados.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(saida).slice(0, 20000) });
    }
    mensagens.push({ role: "user", content: resultados });
  }
  if (!resposta) resposta = "Não consegui concluir a consulta. Tente reformular a pergunta.";
  await admin.from("mensagens").insert({ conversa_id: conversaId, papel: "assistente", conteudo: resposta });
  return json({ resposta, conversa_id: conversaId });
});
