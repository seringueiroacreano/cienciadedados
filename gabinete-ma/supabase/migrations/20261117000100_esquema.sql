-- =====================================================================
-- Gabinete Dep. Marcus Alexandre — esquema do banco (Supabase/Postgres)
-- Segurança: RLS em todas as tabelas; acesso só para perfis ATIVOS.
--   admin    : tudo, inclusive usuários, auditoria e dados do gabinete
--   assessor : lê e grava cadastros
--   consulta : somente leitura
-- =====================================================================

-- ---------------------------------------------------------------- perfis
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text,
  papel text not null default 'consulta' check (papel in ('admin', 'assessor', 'consulta')),
  ativo boolean not null default false,
  ultimo_acesso timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- funções auxiliares usadas pelas políticas (search_path fixo)
create or replace function public.meu_papel()
returns text language sql stable security definer set search_path = '' as $$
  select p.papel from public.perfis p where p.id = auth.uid() and p.ativo
$$;
create or replace function public.pode_ler() returns boolean language sql stable set search_path = '' as $$
  select public.meu_papel() is not null
$$;
create or replace function public.pode_escrever() returns boolean language sql stable set search_path = '' as $$
  select coalesce(public.meu_papel() in ('admin', 'assessor'), false)
$$;
create or replace function public.e_admin() returns boolean language sql stable set search_path = '' as $$
  select coalesce(public.meu_papel() = 'admin', false)
$$;

-- novo usuário do Auth → perfil. O PRIMEIRO vira admin ativo; os demais
-- ficam inativos (somente consulta) até um admin aprovar.
create or replace function public.novo_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
declare primeiro boolean;
begin
  select not exists (select 1 from public.perfis) into primeiro;
  insert into public.perfis (id, nome, email, papel, ativo)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
          new.email, case when primeiro then 'admin' else 'consulta' end, primeiro);
  return new;
end $$;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_usuario();

-- impede ficar sem administrador ativo e impede auto-promoção
create or replace function public.protege_admin()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (tg_op = 'DELETE' and old.papel = 'admin' and old.ativo)
     or (tg_op = 'UPDATE' and old.papel = 'admin' and old.ativo and (new.papel <> 'admin' or not new.ativo)) then
    if (select count(*) from public.perfis where papel = 'admin' and ativo) <= 1 then
      raise exception 'É preciso manter ao menos um administrador ativo.';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger perfis_protege_admin before update or delete on public.perfis
  for each row execute function public.protege_admin();

-- ---------------------------------------------------------------- utilitários
create or replace function public.toca_atualizado()
returns trigger language plpgsql set search_path = '' as $$
begin new.atualizado_em = now(); return new; end $$;

-- ---------------------------------------------------------------- cadastros
create table public.gabinete (
  id int primary key default 1 check (id = 1),
  parlamentar text not null,
  nome_civil text,
  partido text,
  uf text default 'AC',
  casa text default 'Assembleia Legislativa do Estado do Acre',
  predio text, sala text, andar text, telefone text, email text,
  encarregado_lgpd text,
  atualizado_em timestamptz not null default now()
);
insert into public.gabinete (parlamentar, partido) values ('Marcus Alexandre', 'MDB');

create table public.cidadaos (
  id bigint generated always as identity primary key,
  nome text not null check (length(trim(nome)) > 1),
  cpf text unique check (cpf ~ '^\d{3}\.\d{3}\.\d{3}-\d{2}$'),
  nascimento date,
  telefone text, whatsapp text, email text,
  cep text, uf text default 'AC' check (uf ~ '^[A-Z]{2}$'), municipio text, bairro text, endereco text,
  tags text,
  lider boolean not null default false,
  consentimento boolean not null default false,
  base_legal text default 'Atendimento a pedido do titular' check (base_legal in (
    'Consentimento', 'Atendimento a pedido do titular', 'Cumprimento de obrigação legal',
    'Execução de políticas públicas', 'Legítimo interesse')),
  observacoes text,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.instituicoes (
  id bigint generated always as identity primary key,
  nome text not null,
  tipo text check (tipo in ('Associação', 'Igreja', 'Escola', 'Unidade de saúde', 'Prefeitura', 'Secretaria',
    'Cooperativa', 'Sindicato', 'ONG', 'Outro')),
  cnpj text, responsavel text, telefone text, email text,
  cep text, uf text default 'AC', municipio text, bairro text, endereco text, observacoes text,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.autoridades (
  id bigint generated always as identity primary key,
  nome text not null, nome_civil text,
  cargo text, orgao text, partido text, uf text,
  telefone text, email text, gabinete text, aniversario date, observacoes text,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.demandas (
  id bigint generated always as identity primary key,
  protocolo text unique,
  titulo text not null,
  descricao text,
  categoria text check (categoria in ('Saúde', 'Educação', 'Infraestrutura', 'Assistência social', 'Segurança',
    'Emprego e renda', 'Documentação', 'Meio ambiente', 'Produção rural', 'Outro')),
  cidadao_id bigint references public.cidadaos (id) on delete set null,
  instituicao_id bigint references public.instituicoes (id) on delete set null,
  municipio text, bairro text,
  status text not null default 'Aberta' check (status in ('Aberta', 'Em andamento', 'Encaminhada', 'Atendida', 'Não atendida')),
  prioridade text default 'Média' check (prioridade in ('Baixa', 'Média', 'Alta', 'Urgente')),
  responsavel_id uuid references public.perfis (id) on delete set null,
  prazo date,
  encaminhado_para text,
  resposta text,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create or replace function public.gera_protocolo()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.protocolo := to_char(now(), 'YYYY') || '-' || lpad(new.id::text, 5, '0');
  return new;
end $$;
create trigger demandas_protocolo before insert on public.demandas
  for each row execute function public.gera_protocolo();

create table public.atendimentos (
  id bigint generated always as identity primary key,
  data date not null default current_date,
  canal text not null default 'Presencial' check (canal in ('Presencial', 'Telefone', 'WhatsApp', 'E-mail', 'Redes sociais', 'Visita')),
  cidadao_id bigint references public.cidadaos (id) on delete set null,
  assunto text not null,
  relato text,
  demanda_id bigint references public.demandas (id) on delete set null,
  responsavel_id uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.emendas (
  id bigint generated always as identity primary key,
  numero text,
  tipo text default 'Individual' check (tipo in ('Individual', 'Bancada', 'Comissão')),
  ano int not null default extract(year from now())::int check (ano between 2000 and 2100),
  orgao text not null,
  objeto text not null,
  acao text,
  beneficiario text,
  instituicao_id bigint references public.instituicoes (id) on delete set null,
  cidadao_id bigint references public.cidadaos (id) on delete set null,
  contato_politico text,
  origem text,
  responsavel_id uuid references public.perfis (id) on delete set null,
  valor numeric(14, 2) not null check (valor >= 0),
  valor_empenhado numeric(14, 2) check (valor_empenhado >= 0),
  empenho text,
  tramite text,
  status text not null default 'Recebida' check (status in ('Recebida', 'Cadastrada', 'Empenhada',
    'Paga parcialmente', 'Paga', 'Arquivada / Não atendida')),
  valor_pago numeric(14, 2) not null default 0,       -- mantido pelo gatilho de pagamentos
  ultimo_pagamento date,                               -- idem
  cep text, uf text default 'AC', municipio text, bairro text, endereco text,
  observacoes text,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.pagamentos (
  id bigint generated always as identity primary key,
  emenda_id bigint not null references public.emendas (id) on delete cascade,
  data date not null default current_date,
  valor numeric(14, 2) not null check (valor > 0),
  documento text,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- soma dos pagamentos e status automático da emenda
create or replace function public.recalcula_emenda()
returns trigger language plpgsql security definer set search_path = '' as $$
declare eid bigint; pago numeric; ult date; e record; novo text;
begin
  for eid in select distinct x from unnest(array[
      case when tg_op <> 'INSERT' then old.emenda_id end,
      case when tg_op <> 'DELETE' then new.emenda_id end]) as x where x is not null loop
    select coalesce(sum(valor), 0), max(data) into pago, ult from public.pagamentos where emenda_id = eid;
    select * into e from public.emendas where id = eid;
    if not found then continue; end if;
    novo := e.status;
    if e.status <> 'Arquivada / Não atendida' then
      if pago <= 0 then
        if e.status in ('Paga', 'Paga parcialmente') then novo := 'Empenhada'; end if;
      elsif pago >= e.valor then novo := 'Paga';
      else novo := 'Paga parcialmente';
      end if;
    end if;
    update public.emendas set valor_pago = pago, ultimo_pagamento = ult, status = novo where id = eid;
  end loop;
  return null;
end $$;
create trigger pagamentos_recalcula after insert or update or delete on public.pagamentos
  for each row execute function public.recalcula_emenda();

create table public.agenda (
  id bigint generated always as identity primary key,
  titulo text not null,
  inicio timestamptz not null,
  fim timestamptz check (fim is null or fim >= inicio),
  tipo text check (tipo in ('Sessão plenária', 'Comissão', 'Audiência pública', 'Reunião', 'Visita a município',
    'Evento', 'Atendimento', 'Outro')),
  local text, municipio text, participantes text, observacoes text,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.tarefas (
  id bigint generated always as identity primary key,
  titulo text not null,
  descricao text,
  responsavel_id uuid references public.perfis (id) on delete set null,
  prazo date,
  prioridade text default 'Média' check (prioridade in ('Baixa', 'Média', 'Alta', 'Urgente')),
  status text not null default 'A fazer' check (status in ('A fazer', 'Em andamento', 'Concluída')),
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.lembretes (
  id bigint generated always as identity primary key,
  cidadao_id bigint not null references public.cidadaos (id) on delete cascade,
  data date not null,
  motivo text not null,
  feito boolean not null default false,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.documentos (
  id bigint generated always as identity primary key,
  nome text not null,
  arquivo_path text not null,
  arquivo_nome text, arquivo_mime text, arquivo_tamanho bigint,
  tags text,
  emenda_id bigint references public.emendas (id) on delete set null,
  demanda_id bigint references public.demandas (id) on delete set null,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.links (
  id bigint generated always as identity primary key,
  rede text not null,
  url text not null check (url ~ '^https?://'),
  descricao text,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- registro de importações de planilhas
create table public.importacoes (
  id bigint generated always as identity primary key,
  tabela text not null,
  arquivo text,
  linhas int, inseridas int, ignoradas int, com_erro int,
  usuario_id uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

-- registro das perguntas ao assistente (somente o texto já anonimizado)
create table public.assistente_consultas (
  id bigint generated always as identity primary key,
  usuario_id uuid default auth.uid() references public.perfis (id) on delete set null,
  pergunta_anonimizada text not null,
  tokens_entrada int, tokens_saida int,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- auditoria
create table public.auditoria (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  usuario_id uuid,
  usuario_nome text,
  acao text not null,
  tabela text,
  registro_id text,
  detalhe text
);

-- guarda SOMENTE os nomes dos campos alterados, nunca os valores (minimização, LGPD)
create or replace function public.audita()
returns trigger language plpgsql security definer set search_path = '' as $$
declare campos text; rid text;
begin
  if tg_op = 'UPDATE' then
    select string_agg(n.key, ', ' order by n.key) into campos
    from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key not in ('atualizado_em', 'valor_pago', 'ultimo_pagamento');
    if campos is null then return new; end if;
  elsif tg_op = 'INSERT' then
    select string_agg(key, ', ' order by key) into campos from jsonb_each(to_jsonb(new))
    where value <> 'null'::jsonb and key not in ('id', 'criado_em', 'atualizado_em', 'criado_por');
  end if;
  rid := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');
  insert into public.auditoria (usuario_id, usuario_nome, acao, tabela, registro_id, detalhe)
  values (auth.uid(), (select nome from public.perfis where id = auth.uid()),
          lower(case tg_op when 'INSERT' then 'criar' when 'UPDATE' then 'editar' else 'excluir' end),
          tg_table_name, rid, campos);
  return coalesce(new, old);
end $$;

-- eventos que não são escrita em tabela (exportar, relatório do titular, baixar arquivo)
create or replace function public.registrar_evento(p_acao text, p_tabela text default null,
                                                  p_registro text default null, p_detalhe text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_ler() then raise exception 'sem permissão'; end if;
  if p_acao not in ('exportar', 'relatório do titular (LGPD)', 'baixar arquivo', 'visualizar', 'login', 'importar')
  then raise exception 'ação inválida'; end if;
  insert into public.auditoria (usuario_id, usuario_nome, acao, tabela, registro_id, detalhe)
  values (auth.uid(), (select nome from public.perfis where id = auth.uid()), p_acao, p_tabela, p_registro,
          left(p_detalhe, 300));
  if p_acao = 'login' then update public.perfis set ultimo_acesso = now() where id = auth.uid(); end if;
end $$;

-- ---------------------------------------------------------------- gatilhos, RLS e políticas
do $$
declare t text;
begin
  foreach t in array array['cidadaos', 'instituicoes', 'autoridades', 'demandas', 'atendimentos', 'emendas',
                           'pagamentos', 'agenda', 'tarefas', 'lembretes', 'documentos', 'links'] loop
    execute format('create trigger %1$s_atualizado before update on public.%1$I for each row execute function public.toca_atualizado()', t);
    execute format('create trigger %1$s_audita after insert or update or delete on public.%1$I for each row execute function public.audita()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy ler on public.%I for select to authenticated using (public.pode_ler())', t);
    execute format('create policy inserir on public.%I for insert to authenticated with check (public.pode_escrever())', t);
    execute format('create policy alterar on public.%I for update to authenticated using (public.pode_escrever()) with check (public.pode_escrever())', t);
    execute format('create policy excluir on public.%I for delete to authenticated using (public.pode_escrever())', t);
  end loop;
end $$;

create trigger perfis_atualizado before update on public.perfis for each row execute function public.toca_atualizado();
create trigger perfis_audita after insert or update or delete on public.perfis for each row execute function public.audita();
create trigger gabinete_atualizado before update on public.gabinete for each row execute function public.toca_atualizado();
create trigger gabinete_audita after update on public.gabinete for each row execute function public.audita();

alter table public.perfis enable row level security;
create policy ler on public.perfis for select to authenticated using (public.pode_ler() or id = auth.uid());
create policy alterar on public.perfis for update to authenticated using (public.e_admin()) with check (public.e_admin());
create policy excluir on public.perfis for delete to authenticated using (public.e_admin() and id <> auth.uid());

alter table public.gabinete enable row level security;
create policy ler on public.gabinete for select to authenticated using (public.pode_ler());
create policy alterar on public.gabinete for update to authenticated using (public.e_admin()) with check (public.e_admin());

alter table public.auditoria enable row level security;
create policy ler on public.auditoria for select to authenticated using (public.e_admin());

alter table public.importacoes enable row level security;
create policy ler on public.importacoes for select to authenticated using (public.pode_ler());
create policy inserir on public.importacoes for insert to authenticated
  with check (public.pode_escrever() and usuario_id = auth.uid());

alter table public.assistente_consultas enable row level security;
create policy ler on public.assistente_consultas for select to authenticated using (public.e_admin());
create policy inserir on public.assistente_consultas for insert to authenticated
  with check (public.pode_ler() and usuario_id = auth.uid());

-- índices
create index on public.cidadaos (municipio);
create index on public.cidadaos ((extract(month from nascimento)), (extract(day from nascimento)));
create index on public.demandas (status);
create index on public.demandas (cidadao_id);
create index on public.demandas (prazo);
create index on public.atendimentos (cidadao_id);
create index on public.atendimentos (data);
create index on public.emendas (ano);
create index on public.pagamentos (emenda_id);
create index on public.agenda (inicio);
create index on public.lembretes (cidadao_id);
create index on public.auditoria (ts desc);

-- anônimos não acessam nada
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on function public.meu_papel(), public.pode_ler(), public.pode_escrever(), public.e_admin(),
  public.registrar_evento(text, text, text, text) to authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- ---------------------------------------------------------------- arquivos (Storage)
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 8388608)
on conflict (id) do nothing;
create policy "documentos ler" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and public.pode_ler());
create policy "documentos enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.pode_escrever());
create policy "documentos excluir" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.pode_escrever());
