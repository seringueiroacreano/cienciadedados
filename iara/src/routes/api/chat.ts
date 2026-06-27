import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import metasData from "@/data/iara-metas.json";
import unidadesData from "@/data/iara-unidades.json";

type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
};

const SYSTEM_PROMPT = `Você é a IARA — Inteligência Artificial de Rastreamento e Aprendizado de Dados do Tribunal de Justiça do Acre.

Diretrizes:
- Responda em português do Brasil, de forma direta e analítica (Análise Negocial).
- Use as FERRAMENTAS (tools) disponíveis para consultar os dados reais do TJAC quando o usuário pedir números, listas, comparativos ou análises. Não invente números.
- Para conceitos, fórmulas e parametrizações, consulte a BASE NORMATIVA do CNJ (Glossário de Metas e Glossário de Indicadores) — cite a meta/indicador (ex.: "Meta 2 — CNJ", "Taxa de Congestionamento Líquida").
- Para perguntas sobre Metas Nacionais (Meta 1 e Meta 2), use a ferramenta query_metas_nacionais. Para confirmar nomes de unidades judiciais, use query_unidades_judiciais.
- Apresente resultados com tabelas markdown curtas, listas com bullets e negrito para os números-chave.
- Foque em decisão: identifique riscos, tendências, gargalos e recomendações por persona (Magistrado, Gestor, Servidor).
- Você está rodando sobre google/gemini-3.1-pro-preview via Lovable AI Gateway.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "query_serie_mensal",
      description: "Retorna a série mensal agregada (baixados, pendentes, novos) do TCL global ou filtrada por órgão e período (YYYYMM).",
      parameters: {
        type: "object",
        properties: {
          id_orgao: { type: "number", description: "ID do órgão julgador, ou -1 para global" },
          anomes_ini: { type: "number", description: "Mês inicial YYYYMM (opcional)" },
          anomes_fim: { type: "number", description: "Mês final YYYYMM (opcional)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_top_unidades",
      description: "Top N unidades (órgãos julgadores) com maior estoque de processos pendentes.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number", description: "Quantidade (padrão 10)" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_violencia",
      description: "Processos de violência doméstica: ranking por órgão (média de dias) ou processos mais demorados.",
      parameters: {
        type: "object",
        properties: {
          modo: { type: "string", enum: ["por_orgao", "top_demorados"], description: "Tipo de consulta" },
          limit: { type: "number" },
        },
        required: ["modo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_acoes_penais_paradas",
      description: "Ações penais com mais dias sem tramitação. Filtra por classe se fornecida.",
      parameters: {
        type: "object",
        properties: {
          dias_min: { type: "number", description: "Mínimo de dias sem tramitação (ex.: 1000)" },
          classe: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_alertas",
      description: "Alertas ativos do motor IARA, filtráveis por severidade.",
      parameters: {
        type: "object",
        properties: { severidade: { type: "string", enum: ["critica", "alta", "media", "baixa"] }, limit: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_glossario_cnj",
      description: "Busca textual nos Glossários de Metas e Indicadores do CNJ (palavra-chave).",
      parameters: {
        type: "object",
        properties: { termo: { type: "string", description: "Palavra-chave, ex: 'congestionamento', 'meta 2'" } },
        required: ["termo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_metas_nacionais",
      description: "Retorna os indicadores das Metas Nacionais do CNJ (Meta 1 — julgar ≥ casos novos; Meta 2 — julgar acervo antigo), por ano/grau, e ranking por unidade judicial.",
      parameters: {
        type: "object",
        properties: {
          meta: { type: "string", enum: ["meta1", "meta2", "ambas"], description: "Qual meta consultar (padrão ambas)" },
          grau: { type: "string", enum: ["G1", "G2", "JE", "TR"], description: "Filtra por grau de jurisdição" },
          unidade: { type: "string", description: "Nome da unidade judicial (vara, turma, juizado)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_unidades_judiciais",
      description: "Lista as unidades judiciais do TJAC (varas, turmas, juizados) com grau e volume de arquivos. Use para buscar nomes corretos de unidade antes de filtrar outras consultas.",
      parameters: {
        type: "object",
        properties: { termo: { type: "string", description: "Filtro textual pelo nome da unidade (opcional)" } },
      },
    },
  },
];

async function executeTool(name: string, args: any, supabase: SupabaseClient<Database>): Promise<unknown> {
  try {
    if (name === "query_serie_mensal") {
      let q = supabase.from("iara_tcl_monthly").select("anomes,quantidade_baixados,quantidade_pendentes,quantidade_novos");
      q = q.eq("id_orgao_julgador", args.id_orgao ?? -1);
      if (args.anomes_ini) q = q.gte("anomes", args.anomes_ini);
      if (args.anomes_fim) q = q.lte("anomes", args.anomes_fim);
      const { data } = await q.order("anomes");
      const map = new Map<number, { anomes: number; baixados: number; pendentes: number; novos: number }>();
      for (const r of data ?? []) {
        const cur = map.get(r.anomes) ?? { anomes: r.anomes, baixados: 0, pendentes: 0, novos: 0 };
        cur.baixados += r.quantidade_baixados ?? 0;
        cur.pendentes += r.quantidade_pendentes ?? 0;
        cur.novos += r.quantidade_novos ?? 0;
        map.set(r.anomes, cur);
      }
      return Array.from(map.values()).sort((a, b) => a.anomes - b.anomes);
    }
    if (name === "query_top_unidades") {
      const limit = Math.min(args.limit ?? 10, 30);
      const { data } = await supabase.from("iara_tcl_monthly")
        .select("id_orgao_julgador,quantidade_pendentes,anomes")
        .neq("id_orgao_julgador", -1).order("anomes", { ascending: false }).limit(3000);
      const last = new Map<number, { id_orgao: number; pendentes: number; anomes: number }>();
      for (const r of data ?? []) {
        const cur = last.get(r.id_orgao_julgador);
        if (!cur || r.anomes > cur.anomes) last.set(r.id_orgao_julgador, { id_orgao: r.id_orgao_julgador, pendentes: r.quantidade_pendentes ?? 0, anomes: r.anomes });
        else if (r.anomes === cur.anomes) cur.pendentes += r.quantidade_pendentes ?? 0;
      }
      return Array.from(last.values()).sort((a, b) => b.pendentes - a.pendentes).slice(0, limit);
    }
    if (name === "query_violencia") {
      const limit = Math.min(args.limit ?? 10, 30);
      if (args.modo === "top_demorados") {
        const { data } = await supabase.from("iara_violencia").select("orgao_julgador,classe,dias,data_ajuizamento").eq("valido", true).order("dias", { ascending: false }).limit(limit);
        return data ?? [];
      }
      const { data } = await supabase.from("iara_violencia").select("orgao_julgador,dias,valido");
      const map = new Map<string, { soma: number; n: number }>();
      for (const r of data ?? []) {
        if (!r.valido || !r.dias) continue;
        const cur = map.get(r.orgao_julgador ?? "—") ?? { soma: 0, n: 0 };
        cur.soma += r.dias; cur.n += 1; map.set(r.orgao_julgador ?? "—", cur);
      }
      return Array.from(map.entries()).map(([orgao, v]) => ({ orgao, processos: v.n, media_dias: Math.round(v.soma / v.n) }))
        .sort((a, b) => b.media_dias - a.media_dias).slice(0, limit);
    }
    if (name === "query_acoes_penais_paradas") {
      const limit = Math.min(args.limit ?? 15, 50);
      let q = supabase.from("iara_acoes_penais").select("numero,orgao_julgador,classe,dias_sem_tramitacao,data_ajuizamento");
      if (args.dias_min) q = q.gte("dias_sem_tramitacao", args.dias_min);
      if (args.classe) q = q.eq("classe", args.classe);
      const { data } = await q.order("dias_sem_tramitacao", { ascending: false, nullsFirst: false }).limit(limit);
      return data ?? [];
    }
    if (name === "query_alertas") {
      let q = supabase.from("iara_alertas").select("titulo,mensagem,severidade,unidade,criado_em").eq("ativo", true);
      if (args.severidade) q = q.eq("severidade", args.severidade);
      const { data } = await q.order("criado_em", { ascending: false }).limit(Math.min(args.limit ?? 20, 50));
      return data ?? [];
    }
    if (name === "query_glossario_cnj") {
      const termo = String(args.termo ?? "").toLowerCase();
      const { data } = await supabase.from("iara_knowledge_base").select("source,title,content").or(`title.ilike.%${termo}%,content.ilike.%${termo}%`).limit(6);
      return data ?? [];
    }
    if (name === "query_metas_nacionais") {
      const metas = metasData as {
        meta1Serie: { ano: number; grau: string; casosNovos: number; julgados: number; pendentes: number; indiceMeta1: number | null }[];
        meta1Unidades: { unidade: string; grau: string; casosNovos: number; julgados: number; indiceMeta1: number | null }[];
        meta2Serie: { ano: number; grau: string; distribuidos: number; julgados: number; distribuidosAntigos: number; julgadosAntigos: number; indiceMeta2: number | null }[];
        meta2Unidades: { unidade: string; grau: string; distribuidos: number; julgados: number }[];
      };
      const grauF = args.grau as string | undefined;
      const unidadeF = (args.unidade as string | undefined)?.toLowerCase();
      const which = (args.meta as string | undefined) ?? "ambas";
      const result: Record<string, unknown> = {};
      if (which === "meta1" || which === "ambas") {
        result.meta1Serie = metas.meta1Serie.filter((r) => !grauF || r.grau === grauF);
        result.meta1Unidades = metas.meta1Unidades.filter((r) => (!grauF || r.grau === grauF) && (!unidadeF || r.unidade.toLowerCase().includes(unidadeF))).slice(0, 15);
      }
      if (which === "meta2" || which === "ambas") {
        result.meta2Serie = metas.meta2Serie.filter((r) => !grauF || r.grau === grauF);
        result.meta2Unidades = metas.meta2Unidades.filter((r) => (!grauF || r.grau === grauF) && (!unidadeF || r.unidade.toLowerCase().includes(unidadeF))).slice(0, 15);
      }
      return result;
    }
    if (name === "query_unidades_judiciais") {
      const unidades = unidadesData as { unidade: string; grau: string; arquivos: string }[];
      const termo = String(args.termo ?? "").toLowerCase();
      return unidades
        .filter((u) => u.unidade && (!termo || u.unidade.toLowerCase().includes(termo)))
        .slice(0, 40);
    }
    return { error: `Ferramenta desconhecida: ${name}` };
  } catch (e) {
    return { error: String(e).slice(0, 200) };
  }
}

const MAX_MESSAGES = 20;
const MAX_CONTENT_CHARS = 4000;
const MAX_TOOL_ROUNDS = 4;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return json({ error: "Não autenticado" }, 401);
        }
        const token = authHeader.slice(7).trim();
        if (!token) return json({ error: "Não autenticado" }, 401);

        const authClient = createClient<Database>(
          process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
        );
        const { data: userData, error: userErr } = await authClient.auth.getUser(token);
        if (userErr || !userData?.user?.id) return json({ error: "Token inválido" }, 401);

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

        const body = (await request.json()) as { messages: { role: "user" | "assistant"; content: string }[] };
        if (!Array.isArray(body?.messages)) return json({ error: "Bad request" }, 400);

        const sanitized = body.messages
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length > 0)
          .slice(-MAX_MESSAGES)
          .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT_CHARS) }));
        if (sanitized.length === 0) return json({ error: "Nenhuma mensagem válida" }, 400);

        // Cliente com auth do usuário para queries de ferramenta (respeita RLS)
        const userSupabase = createClient<Database>(
          process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!,
          { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
        );

        const conversation: ChatMessage[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...sanitized,
        ];

        const toolTrace: { name: string; args: unknown }[] = [];

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: "google/gemini-3.1-pro-preview",
              messages: conversation,
              tools: TOOLS,
              tool_choice: "auto",
            }),
          });
          if (!resp.ok) {
            const txt = await resp.text();
            return json({ error: `Gateway ${resp.status}: ${txt.slice(0, 200)}` }, resp.status === 429 ? 429 : resp.status === 402 ? 402 : 500);
          }
          const data = await resp.json() as { choices?: { message?: ChatMessage }[] };
          const msg = data.choices?.[0]?.message;
          if (!msg) return json({ error: "Resposta vazia do modelo" }, 500);

          conversation.push(msg);

          const toolCalls = msg.tool_calls ?? [];
          if (toolCalls.length === 0) {
            return json({
              content: msg.content ?? "",
              tools: toolTrace,
              model: "google/gemini-3.1-pro-preview",
            }, 200);
          }

          for (const tc of toolCalls) {
            let args: any = {};
            try { args = JSON.parse(tc.function.arguments || "{}"); } catch { args = {}; }
            toolTrace.push({ name: tc.function.name, args });
            const result = await executeTool(tc.function.name, args, userSupabase);
            conversation.push({
              role: "tool", tool_call_id: tc.id, name: tc.function.name,
              content: JSON.stringify(result).slice(0, 8000),
            });
          }
        }

        return json({ content: "(Limite de chamadas de ferramentas atingido sem resposta final.)", tools: toolTrace, model: "google/gemini-3.1-pro-preview" }, 200);
      },
    },
  },
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}
