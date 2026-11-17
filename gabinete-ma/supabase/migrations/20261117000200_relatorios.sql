-- =====================================================================
-- Relatórios (RPC). Todas são SECURITY INVOKER: respeitam a RLS de quem chama.
-- Datas "de hoje" usam o fuso do Acre (America/Rio_Branco, UTC-5).
-- =====================================================================

create or replace function public.hoje_ac() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Rio_Branco')::date
$$;

-- ---------------------------------------------------------------- Visão geral
create or replace function public.painel() returns jsonb language sql stable set search_path = '' as $$
  with h as (select public.hoje_ac() as d, extract(year from public.hoje_ac())::int as ano)
  select jsonb_build_object(
    'cidadaos', (select count(*) from public.cidadaos),
    'cidadaos_novos_30d', (select count(*) from public.cidadaos where criado_em >= now() - interval '30 days'),
    'liderancas', (select count(*) from public.cidadaos where lider),
    'demandas_total', (select count(*) from public.demandas),
    'demandas_abertas', (select count(*) from public.demandas where status not in ('Atendida', 'Não atendida')),
    'demandas_atrasadas', (select count(*) from public.demandas, h where prazo < h.d and status not in ('Atendida', 'Não atendida')),
    'taxa_resolucao', (select case when count(*) = 0 then null
                         else round(100.0 * count(*) filter (where status = 'Atendida') / count(*)) end from public.demandas),
    'demandas_por_status', coalesce((select jsonb_agg(x order by x.n desc) from (
        select status as chave, count(*) as n from public.demandas group by status) x), '[]'),
    'demandas_por_categoria', coalesce((select jsonb_agg(x order by x.n desc) from (
        select coalesce(categoria, 'Sem categoria') as chave, count(*) as n from public.demandas group by 1) x), '[]'),
    'atendimentos_30d', (select count(*) from public.atendimentos, h where data >= h.d - 30),
    'atendimentos_por_canal', coalesce((select jsonb_agg(x order by x.n desc) from (
        select canal as chave, count(*) as n from public.atendimentos, h where data >= h.d - 30 group by canal) x), '[]'),
    'emendas_ano', (select ano from h),
    'emendas', (select jsonb_build_object('n', count(*), 'indicado', coalesce(sum(valor), 0),
                  'empenhado', coalesce(sum(valor_empenhado), 0), 'pago', coalesce(sum(valor_pago), 0))
                from public.emendas, h where emendas.ano = h.ano),
    'emendas_por_status', coalesce((select jsonb_agg(x order by x.valor desc) from (
        select status as chave, count(*) as n, sum(valor) as valor from public.emendas, h
        where emendas.ano = h.ano group by status) x), '[]'),
    'tarefas_abertas', (select count(*) from public.tarefas where status <> 'Concluída'),
    'tarefas_atrasadas', (select count(*) from public.tarefas, h where status <> 'Concluída' and prazo < h.d),
    'proximos_compromissos', coalesce((select jsonb_agg(x order by x.inicio) from (
        select id, titulo, inicio, local, municipio from public.agenda, h
        where (inicio at time zone 'America/Rio_Branco')::date between h.d and h.d + 7
        order by inicio limit 8) x), '[]')
  )
$$;

-- ---------------------------------------------------------------- Notificações do dia
create or replace function public.notificacoes(dia date default null) returns jsonb
language sql stable set search_path = '' as $$
  with h as (select coalesce(dia, public.hoje_ac()) as d)
  select jsonb_build_object(
    'data', (select d from h),
    'tarefas', coalesce((select jsonb_agg(x order by x.prazo) from (
        select t.id, t.titulo, t.prazo, t.prioridade, p.nome as responsavel
        from public.tarefas t left join public.perfis p on p.id = t.responsavel_id, h
        where t.status <> 'Concluída' and t.prazo <= h.d) x), '[]'),
    'aniversariantes', coalesce((select jsonb_agg(x order by x.nome) from (
        select c.id, c.nome, c.telefone, c.whatsapp, c.consentimento, 'cidadaos' as origem,
               extract(year from h.d)::int - extract(year from c.nascimento)::int as idade
        from public.cidadaos c, h
        where extract(month from c.nascimento) = extract(month from h.d) and extract(day from c.nascimento) = extract(day from h.d)
        union all
        select a.id, a.nome, a.telefone, null, false, 'autoridades', null
        from public.autoridades a, h
        where extract(month from a.aniversario) = extract(month from h.d) and extract(day from a.aniversario) = extract(day from h.d)) x), '[]'),
    'compromissos', coalesce((select jsonb_agg(x order by x.inicio) from (
        select id, titulo, inicio, fim, local, municipio from public.agenda, h
        where (inicio at time zone 'America/Rio_Branco')::date = h.d) x), '[]'),
    'lembretes', coalesce((select jsonb_agg(x order by x.data) from (
        select l.id, l.data, l.motivo, c.nome as cidadao, c.telefone, c.id as cidadao_id
        from public.lembretes l join public.cidadaos c on c.id = l.cidadao_id, h
        where not l.feito and l.data <= h.d) x), '[]'),
    'demandas_vencidas', coalesce((select jsonb_agg(x order by x.prazo) from (
        select id, protocolo, titulo, prazo, status from public.demandas, h
        where prazo < h.d and status not in ('Atendida', 'Não atendida')) x), '[]')
  )
$$;

-- ---------------------------------------------------------------- Aniversariantes por período
create or replace function public.aniversarios(inicio date, fim date, so_lider boolean default false,
  so_autoridade boolean default false, cadastrado_por uuid default null)
returns jsonb language sql stable set search_path = '' as $$
  with p as (select to_char(inicio, 'MM-DD') as a, to_char(fim, 'MM-DD') as b, extract(year from inicio)::int as ano),
  base as (
    select c.id, c.nome, c.tags, c.telefone, c.whatsapp, c.nascimento as data, c.consentimento, 'cidadaos' as origem
    from public.cidadaos c where not so_autoridade and c.nascimento is not null
      and (not so_lider or c.lider) and (cadastrado_por is null or c.criado_por = cadastrado_por)
    union all
    select a.id, a.nome, a.cargo, a.telefone, null, a.aniversario, false, 'autoridades'
    from public.autoridades a where so_autoridade and a.aniversario is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome, 'tags', b.tags, 'telefone', b.telefone,
      'whatsapp', b.whatsapp, 'consentimento', b.consentimento, 'origem', b.origem,
      'dia', to_char(b.data, 'DD/MM'), 'idade', p.ano - extract(year from b.data)::int)
      order by to_char(b.data, 'MM-DD'), b.nome), '[]')
  from base b, p
  where case when p.a <= p.b then to_char(b.data, 'MM-DD') between p.a and p.b
             else to_char(b.data, 'MM-DD') >= p.a or to_char(b.data, 'MM-DD') <= p.b end
$$;

-- ---------------------------------------------------------------- Mapa por município
create or replace function public.mapa() returns jsonb language sql stable set search_path = '' as $$
  with m as (
    select municipio, count(*) as cidadaos, 0::bigint as demandas, 0::bigint as demandas_abertas,
           0::bigint as emendas, 0::numeric as emendas_valor, 0::numeric as emendas_pago, 0::bigint as atendimentos
      from public.cidadaos group by municipio
    union all
    select municipio, 0, count(*), count(*) filter (where status not in ('Atendida', 'Não atendida')), 0, 0, 0, 0
      from public.demandas group by municipio
    union all
    select municipio, 0, 0, 0, count(*), sum(valor), sum(valor_pago), 0 from public.emendas group by municipio
    union all
    select c.municipio, 0, 0, 0, 0, 0, 0, count(*) from public.atendimentos a join public.cidadaos c on c.id = a.cidadao_id
      group by c.municipio
  )
  select coalesce(jsonb_agg(x order by x.cidadaos desc, x.municipio), '[]') from (
    select coalesce(municipio, 'Não informado') as municipio, sum(cidadaos) as cidadaos, sum(demandas) as demandas,
           sum(demandas_abertas) as demandas_abertas, sum(emendas) as emendas, sum(emendas_valor) as emendas_valor,
           sum(emendas_pago) as emendas_pago, sum(atendimentos) as atendimentos
    from m group by 1) x
$$;

-- ---------------------------------------------------------------- LGPD: dados de um titular (art. 18)
create or replace function public.titular(cid bigint) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'gerado_em', now(),
    'cidadao', (select to_jsonb(c) - 'criado_por' from public.cidadaos c where c.id = cid),
    'demandas', coalesce((select jsonb_agg(to_jsonb(d) - 'criado_por') from public.demandas d where d.cidadao_id = cid), '[]'),
    'atendimentos', coalesce((select jsonb_agg(to_jsonb(a) - 'criado_por') from public.atendimentos a where a.cidadao_id = cid), '[]'),
    'lembretes', coalesce((select jsonb_agg(to_jsonb(l) - 'criado_por') from public.lembretes l where l.cidadao_id = cid), '[]'),
    'emendas', coalesce((select jsonb_agg(to_jsonb(e) - 'criado_por') from public.emendas e where e.cidadao_id = cid), '[]')
  )
$$;

-- ---------------------------------------------------------------- Assistente de IA: contexto ANONIMIZADO
-- Só agregados. Nunca envia nome, CPF, telefone, e-mail, endereço, bairro, data de nascimento,
-- tags (podem revelar religião, saúde etc. — dados sensíveis), textos livres de demandas/atendimentos
-- nem beneficiários/contatos de emendas. Grupos com menos de 3 pessoas são suprimidos (k-anonimato).
create or replace function public.assistente_contexto() returns jsonb language sql stable set search_path = '' as $$
  with h as (select public.hoje_ac() as d),
  k as (select 3 as minimo)
  select jsonb_build_object(
    'gerado_em', (select d from h),
    'observacao', 'Dados agregados e anonimizados. Contagens de pessoas abaixo de 3 aparecem como "<3".',
    'cidadaos', jsonb_build_object(
      'total', (select count(*) from public.cidadaos),
      'novos_30d', (select count(*) from public.cidadaos where criado_em >= now() - interval '30 days'),
      'liderancas', (select count(*) from public.cidadaos where lider),
      'com_autorizacao_de_contato', (select count(*) from public.cidadaos where consentimento),
      'por_municipio', coalesce((select jsonb_object_agg(m, case when n < (select minimo from k) then to_jsonb('<3'::text) else to_jsonb(n) end)
          from (select coalesce(municipio, 'Não informado') m, count(*) n from public.cidadaos group by 1) x), '{}'),
      'por_faixa_etaria', coalesce((select jsonb_object_agg(f, case when n < (select minimo from k) then to_jsonb('<3'::text) else to_jsonb(n) end)
          from (select case when nascimento is null then 'não informada'
                            when age(nascimento) < interval '25 years' then '16-24'
                            when age(nascimento) < interval '35 years' then '25-34'
                            when age(nascimento) < interval '50 years' then '35-49'
                            when age(nascimento) < interval '65 years' then '50-64' else '65+' end f, count(*) n
                from public.cidadaos group by 1) x), '{}')),
    'demandas', jsonb_build_object(
      'total', (select count(*) from public.demandas),
      'por_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.demandas group by 1) x), '{}'),
      'por_categoria', coalesce((select jsonb_object_agg(c, n) from (select coalesce(categoria, 'Sem categoria') c, count(*) n from public.demandas group by 1) x), '{}'),
      'por_municipio', coalesce((select jsonb_object_agg(m, n) from (select coalesce(municipio, 'Não informado') m, count(*) n from public.demandas group by 1) x), '{}'),
      'abertas_com_prazo_vencido', (select count(*) from public.demandas, h where prazo < h.d and status not in ('Atendida', 'Não atendida')),
      'tempo_medio_resolucao_dias', (select round(avg(extract(epoch from (atualizado_em - criado_em)) / 86400)::numeric, 1)
                                     from public.demandas where status = 'Atendida'),
      'por_mes_ultimos_12', coalesce((select jsonb_object_agg(mes, n) from (
          select to_char(criado_em, 'YYYY-MM') mes, count(*) n from public.demandas
          where criado_em >= now() - interval '12 months' group by 1) x), '{}')),
    'atendimentos', jsonb_build_object(
      'total', (select count(*) from public.atendimentos),
      'ultimos_30d', (select count(*) from public.atendimentos, h where data >= h.d - 30),
      'por_canal', coalesce((select jsonb_object_agg(canal, n) from (select canal, count(*) n from public.atendimentos group by 1) x), '{}'),
      'por_mes_ultimos_12', coalesce((select jsonb_object_agg(mes, n) from (
          select to_char(data, 'YYYY-MM') mes, count(*) n from public.atendimentos
          where data >= (select d from h) - 365 group by 1) x), '{}')),
    'emendas', coalesce((select jsonb_agg(jsonb_build_object('ano', ano, 'tipo', tipo, 'orgao', orgao, 'objeto', objeto,
        'municipio', municipio, 'valor', valor, 'empenhado', valor_empenhado, 'pago', valor_pago, 'status', status,
        'ultimo_pagamento', ultimo_pagamento) order by ano desc, valor desc) from public.emendas), '[]'),
    'agenda_proximos_30d', coalesce((select jsonb_object_agg(t, n) from (
        select coalesce(tipo, 'Outro') t, count(*) n from public.agenda, h
        where (inicio at time zone 'America/Rio_Branco')::date between h.d and h.d + 30 group by 1) x), '{}'),
    'tarefas', jsonb_build_object(
      'abertas', (select count(*) from public.tarefas where status <> 'Concluída'),
      'atrasadas', (select count(*) from public.tarefas, h where status <> 'Concluída' and prazo < h.d))
  )
  where public.pode_ler()
$$;

grant execute on function public.hoje_ac(), public.painel(), public.notificacoes(date),
  public.aniversarios(date, date, boolean, boolean, uuid), public.mapa(), public.titular(bigint),
  public.assistente_contexto() to authenticated;
