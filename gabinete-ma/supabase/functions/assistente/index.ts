// Assistente de IA do Gabinete — Supabase Edge Function (Deno).
//
// Privacidade (LGPD):
//  1. Só usuários ATIVOS do gabinete podem perguntar (JWT do Supabase + RLS).
//  2. O contexto enviado à IA vem de public.assistente_contexto(): apenas números agregados,
//     com grupos de menos de 3 pessoas suprimidos. Nenhum nome, CPF, telefone, endereço,
//     data de nascimento, tag ou texto livre de demanda/atendimento sai do banco.
//  3. A própria pergunta é anonimizada (CPF, telefone, e-mail, CEP, datas e números longos
//     são substituídos por marcadores) antes do envio.
//  4. Fica registrada só a pergunta anonimizada (tabela assistente_consultas).
//
// Configuração: no painel do Supabase → Edge Functions → Secrets, crie ANTHROPIC_API_KEY.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SISTEMA = `Você é o assistente de análise de dados do gabinete de um deputado estadual do Acre.
Responda em português do Brasil, de forma objetiva, usando SOMENTE os dados agregados fornecidos em <dados>.
Regras:
- Se a resposta não estiver nos dados, diga isso claramente e sugira qual cadastro ou relatório do sistema consultar.
- Nunca invente números. Cite os números que usar.
- Os dados são anonimizados: nunca tente identificar pessoas, nem peça nomes, CPF ou contatos.
- Valores de emendas estão em reais (R$).
- Não produza conteúdo de campanha eleitoral nem sugira usar dados do mandato para fins eleitorais.
- Ao final, quando fizer sentido, sugira até 3 ações de gestão concretas para a equipe.`;

export function anonimizar(texto: string): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[E-MAIL]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]")
    .replace(/\(?\b\d{2}\)?\s?9?\s?\d{4}[-\s]?\d{4}\b/g, "[TELEFONE]")
    .replace(/\b\d{5}-?\d{3}\b/g, "[CEP]")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "[DATA]")
    .replace(/\b\d{9,}\b/g, "[NÚMERO]");
}

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return resposta({ erro: "Não autenticado." }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });

  const { data: papel } = await supabase.rpc("meu_papel");
  if (!papel) return resposta({ erro: "Seu acesso ainda não foi aprovado pelo administrador." }, 403);

  let pergunta = "";
  try {
    pergunta = String((await req.json()).pergunta ?? "").trim();
  } catch {
    return resposta({ erro: "Corpo inválido." }, 400);
  }
  if (pergunta.length < 3 || pergunta.length > 1000) {
    return resposta({ erro: "Escreva uma pergunta de 3 a 1000 caracteres." }, 400);
  }
  const perguntaAnon = anonimizar(pergunta);

  const { data: contexto, error } = await supabase.rpc("assistente_contexto");
  if (error || !contexto) return resposta({ erro: "Não foi possível montar os dados agregados." }, 500);

  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) {
    return resposta({
      erro: "Assistente ainda não configurado: o administrador precisa cadastrar a chave ANTHROPIC_API_KEY nos Secrets das Edge Functions do Supabase.",
      contexto, pergunta_enviada: perguntaAnon,
    }, 503);
  }

  const client = new Anthropic({ apiKey: chave });
  try {
    const msg = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SISTEMA,
      messages: [{
        role: "user",
        content: `<dados>\n${JSON.stringify(contexto)}\n</dados>\n\n<pergunta>\n${perguntaAnon}\n</pergunta>`,
      }],
    } as Parameters<typeof client.beta.messages.create>[0]);

    if (msg.stop_reason === "refusal") {
      return resposta({ erro: "A IA não pôde responder a esta pergunta. Reformule-a.", pergunta_enviada: perguntaAnon }, 422);
    }
    const texto = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();

    await supabase.from("assistente_consultas").insert({
      pergunta_anonimizada: perguntaAnon,
      tokens_entrada: msg.usage?.input_tokens ?? null,
      tokens_saida: msg.usage?.output_tokens ?? null,
    });

    return resposta({
      resposta: texto || "(sem resposta)",
      truncada: msg.stop_reason === "max_tokens",
      contexto,
      pergunta_enviada: perguntaAnon,
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return resposta({ erro: "Muitas consultas agora. Tente em instantes." }, 429);
    if (e instanceof Anthropic.AuthenticationError) return resposta({ erro: "Chave da IA inválida. Avise o administrador." }, 502);
    if (e instanceof Anthropic.APIError) return resposta({ erro: `Erro do serviço de IA (${e.status}).` }, 502);
    console.error(e);
    return resposta({ erro: "Erro inesperado no assistente." }, 500);
  }
});
