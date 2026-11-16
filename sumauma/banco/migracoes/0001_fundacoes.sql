-- Sumaúma: fundações do banco.
-- Acesso: só entra quem tem e-mail @tjac.jus.br ou está na lista de acessos liberados.
-- Leitura: qualquer pessoa com perfil. Escrita: só a carga diária (chave de serviço).

create table public.acessos_liberados (
  email text primary key check (email = lower(email)),
  papel text not null default 'leitor' check (papel in ('admin', 'leitor')),
  criado_em timestamptz not null default now()
);

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  papel text not null default 'leitor' check (papel in ('admin', 'leitor')),
  criado_em timestamptz not null default now()
);

-- Barra o cadastro de quem não é do tribunal nem está na lista.
create function public.restringir_cadastro() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null
     or not (lower(new.email) like '%@tjac.jus.br'
             or exists (select 1 from public.acessos_liberados a where a.email = lower(new.email))) then
    raise exception 'Cadastro permitido apenas para contas @tjac.jus.br.';
  end if;
  return new;
end $$;

create trigger sumauma_restringir_cadastro before insert on auth.users
  for each row execute function public.restringir_cadastro();

-- Cria o perfil quando a conta nasce.
create function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, email, papel)
  values (new.id, lower(new.email),
          coalesce((select a.papel from public.acessos_liberados a where a.email = lower(new.email)), 'leitor'));
  return new;
end $$;

create trigger sumauma_criar_perfil after insert on auth.users
  for each row execute function public.criar_perfil();

create schema if not exists privado;

create function privado.tem_acesso() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis p where p.id = (select auth.uid()));
$$;

create function privado.eh_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis p where p.id = (select auth.uid()) and p.papel = 'admin');
$$;

grant usage on schema privado to authenticated;
grant execute on function privado.tem_acesso(), privado.eh_admin() to authenticated;
revoke execute on function public.restringir_cadastro(), public.criar_perfil() from public, anon, authenticated;

-- ---------- dados ----------
create table public.cargas (
  id bigint generated always as identity primary key,
  meta smallint not null,
  base_publicada_em timestamptz not null,
  carregada_em timestamptz not null default now(),
  linhas integer not null,
  situacao text not null default 'ok' check (situacao in ('ok', 'erro')),
  mensagem text,
  unique (meta, base_publicada_em)
);

create table public.unidades (
  id bigint generated always as identity primary key,
  nome text not null unique,
  municipio text
);

-- Fotografia do dia: uma linha por meta, unidade e recorte da meta.
create table public.indicadores_diarios (
  data_base date not null,
  meta smallint not null,
  unidade_id bigint not null references public.unidades (id),
  recorte text not null,
  percentual_exigido numeric,
  distribuidos integer not null default 0,
  suspensos integer not null default 0,
  fora_computo integer not null default 0,
  julgados integer not null default 0,
  a_julgar integer not null default 0,
  cumprimento numeric,
  faltam integer not null default 0,
  detalhes jsonb not null default '{}'::jsonb,
  primary key (data_base, meta, unidade_id, recorte)
);
create index indicadores_diarios_unidade_idx on public.indicadores_diarios (unidade_id, meta, data_base);

-- Série mensal reconstruída pela data de cada evento na base.
create table public.serie_mensal (
  meta smallint not null,
  unidade_id bigint not null references public.unidades (id),
  variavel text not null,
  anomes integer not null,
  quantidade integer not null,
  atualizada_em timestamptz not null default now(),
  primary key (meta, unidade_id, variavel, anomes)
);

-- Lista atual de processos por situação; substituída a cada carga.
create table public.fila_trabalho (
  meta smallint not null,
  recorte text not null,
  id_processo text not null,
  unidade_id bigint not null references public.unidades (id),
  processo text not null,
  situacao text not null,
  origem text,
  distribuido_em date,
  evento_em date,
  grau text,
  classe text,
  natureza text,
  sistema text,
  data_base date not null,
  primary key (meta, recorte, id_processo)
);
create index fila_trabalho_unidade_idx on public.fila_trabalho (unidade_id, meta, situacao, distribuido_em);

create table public.previsoes (
  id bigint generated always as identity primary key,
  gerada_em timestamptz not null default now(),
  data_base date not null,
  meta smallint not null,
  unidade_id bigint references public.unidades (id),  -- nulo = tribunal inteiro
  recorte text not null,
  variavel text not null,
  anomes integer not null,
  valor numeric not null,
  limite_inferior numeric,
  limite_superior numeric,
  modelo text not null,
  erro_backtest numeric
);
create index previsoes_consulta_idx on public.previsoes (meta, unidade_id, data_base);

create table public.conversas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text,
  criada_em timestamptz not null default now()
);
create index conversas_usuario_idx on public.conversas (usuario_id, criada_em desc);

create table public.mensagens (
  id bigint generated always as identity primary key,
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  papel text not null check (papel in ('usuario', 'assistente')),
  conteudo text not null,
  criada_em timestamptz not null default now()
);
create index mensagens_conversa_idx on public.mensagens (conversa_id, criada_em);

-- ---------- segurança por linha ----------
alter table public.acessos_liberados enable row level security;
alter table public.perfis enable row level security;
alter table public.cargas enable row level security;
alter table public.unidades enable row level security;
alter table public.indicadores_diarios enable row level security;
alter table public.serie_mensal enable row level security;
alter table public.fila_trabalho enable row level security;
alter table public.previsoes enable row level security;
alter table public.conversas enable row level security;
alter table public.mensagens enable row level security;

create policy "admin gerencia acessos" on public.acessos_liberados for all to authenticated
  using ((select privado.eh_admin())) with check ((select privado.eh_admin()));
create policy "cada um vê o próprio perfil; admin vê todos" on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select privado.eh_admin()));

create policy "leitura para quem tem perfil" on public.cargas for select to authenticated using ((select privado.tem_acesso()));
create policy "leitura para quem tem perfil" on public.unidades for select to authenticated using ((select privado.tem_acesso()));
create policy "leitura para quem tem perfil" on public.indicadores_diarios for select to authenticated using ((select privado.tem_acesso()));
create policy "leitura para quem tem perfil" on public.serie_mensal for select to authenticated using ((select privado.tem_acesso()));
create policy "leitura para quem tem perfil" on public.fila_trabalho for select to authenticated using ((select privado.tem_acesso()));
create policy "leitura para quem tem perfil" on public.previsoes for select to authenticated using ((select privado.tem_acesso()));

create policy "cada um com as próprias conversas" on public.conversas for all to authenticated
  using (usuario_id = (select auth.uid()) and (select privado.tem_acesso()))
  with check (usuario_id = (select auth.uid()) and (select privado.tem_acesso()));
create policy "mensagens das próprias conversas" on public.mensagens for select to authenticated
  using (exists (select 1 from public.conversas c where c.id = conversa_id and c.usuario_id = (select auth.uid())));

-- Quem não entrou não enxerga nada.
revoke all on all tables in schema public from anon;
