-- Teste do banco do Gabinete (não grava nada: termina em ROLLBACK).
-- Como rodar: Supabase → projeto gabinete-marcus-alexandre → SQL Editor → cole tudo → Run.
-- Resultado esperado está ao lado de cada linha da tabela final (coluna k).
begin;
create temp table r (k text, v text) on commit drop;
grant all on r to authenticated, anon;

-- dois usuários fictícios: o primeiro vira admin ativo; o segundo fica inativo
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm@teste.org', '{"nome":"Admin Teste"}', now(), now()),
       ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'novo@teste.org', '{"nome":"Novo"}', now(), now());
insert into r select 'perfis (esperado: Admin admin ativo | Novo consulta inativo)',
  string_agg(nome||':'||papel||':'||ativo, ' | ' order by nome) from public.perfis;

-- usuário inativo não enxerga nada
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
insert into r select 'inativo vê gabinete (esperado 0)', count(*)::text from public.gabinete;
reset role;

-- admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into r select 'admin vê gabinete (esperado Marcus Alexandre/MDB)', parlamentar||'/'||partido from public.gabinete;
insert into public.cidadaos (nome, cpf, municipio, nascimento)
  values ('Maria Teste', '529.982.247-25', 'Xapuri', ('1980-' || to_char(public.hoje_ac(), 'MM-DD'))::date);
insert into public.demandas (titulo) values ('Teste protocolo');
insert into r select 'protocolo (esperado AAAA-00001)', protocolo from public.demandas;
insert into public.emendas (orgao, objeto, valor, municipio) values ('SESACRE', 'Ambulância', 100000, 'Xapuri');
insert into public.pagamentos (emenda_id, valor) select id, 40000 from public.emendas;
insert into r select 'emenda após 40 mil (esperado Paga parcialmente)', status||' '||valor_pago from public.emendas;
insert into public.pagamentos (emenda_id, valor) select id, 60000 from public.emendas;
insert into r select 'emenda após 100 mil (esperado Paga)', status||' '||valor_pago from public.emendas;
delete from public.pagamentos where valor = 60000;
insert into r select 'emenda após excluir (esperado Paga parcialmente 40000)', status||' '||valor_pago from public.emendas;
insert into r select 'painel emendas', (public.painel()->'emendas')::text;
insert into r select 'aniversariantes hoje (esperado 1)', jsonb_array_length(public.notificacoes()->'aniversariantes')::text;
insert into r select 'mapa', public.mapa()::text;
insert into r select 'IA por município (esperado Xapuri "<3")', (public.assistente_contexto()->'cidadaos'->'por_municipio')::text;
insert into r select 'aniversários no período (esperado 1)', jsonb_array_length(public.aniversarios(public.hoje_ac(), public.hoje_ac()))::text;
insert into r select 'auditoria (sem valores, só campos)', string_agg(acao||':'||tabela||':'||coalesce(detalhe,''), ' | ' order by id) from public.auditoria;
do $$ begin
  begin
    update public.perfis set papel = 'consulta' where email = 'adm@teste.org';
    insert into r values ('remover último admin (esperado bloqueado)', 'PERMITIU — ERRO');
  exception when others then insert into r values ('remover último admin (esperado bloqueado)', 'bloqueado: '||sqlerrm); end;
end $$;
reset role;

-- visitante sem login
set local role anon;
do $$ begin
  begin
    perform 1 from public.cidadaos;
    insert into r values ('anônimo lê cidadãos (esperado bloqueado)', 'LEU — ERRO');
  exception when others then insert into r values ('anônimo lê cidadãos (esperado bloqueado)', 'bloqueado: '||sqlerrm); end;
end $$;
reset role;

select * from r;
rollback;
