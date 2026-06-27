
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','magistrado','gestor','servidor');
CREATE TYPE public.iara_persona AS ENUM ('magistrado','gestor','servidor');
CREATE TYPE public.iara_alert_severity AS ENUM ('baixa','media','alta','critica');
CREATE TYPE public.iara_source_status AS ENUM ('conectado','sincronizando','pendente','erro');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  persona public.iara_persona NOT NULL DEFAULT 'gestor',
  unidade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles_self_upsert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'servidor') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ANALYTICAL TABLES ============
-- Taxa de Congestionamento Líquida (mensal por órgão julgador)
CREATE TABLE public.iara_tcl_monthly (
  id BIGSERIAL PRIMARY KEY,
  grau TEXT NOT NULL,
  id_orgao_julgador INTEGER NOT NULL,
  procedimento TEXT NOT NULL,
  anomes INTEGER NOT NULL,
  quantidade_baixados INTEGER NOT NULL DEFAULT 0,
  quantidade_pendentes INTEGER NOT NULL DEFAULT 0,
  quantidade_baixados_12m NUMERIC NOT NULL DEFAULT 0
);
CREATE INDEX idx_tcl_anomes ON public.iara_tcl_monthly(anomes);
CREATE INDEX idx_tcl_orgao ON public.iara_tcl_monthly(id_orgao_julgador);
GRANT SELECT ON public.iara_tcl_monthly TO authenticated;
GRANT ALL ON public.iara_tcl_monthly TO service_role;
ALTER TABLE public.iara_tcl_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcl_read_authenticated" ON public.iara_tcl_monthly FOR SELECT TO authenticated USING (true);

-- Violência doméstica (duração de processos)
CREATE TABLE public.iara_violencia (
  id BIGSERIAL PRIMARY KEY,
  sigla_grau TEXT,
  id_ultimo_oj INTEGER,
  orgao_julgador TEXT,
  numero_sigilo TEXT,
  classe TEXT,
  data_ajuizamento DATE,
  data_inicio DATE,
  data_fim DATE,
  valido BOOLEAN,
  dias INTEGER
);
CREATE INDEX idx_violencia_orgao ON public.iara_violencia(orgao_julgador);
CREATE INDEX idx_violencia_valido ON public.iara_violencia(valido);
GRANT SELECT ON public.iara_violencia TO authenticated;
GRANT ALL ON public.iara_violencia TO service_role;
ALTER TABLE public.iara_violencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "violencia_read_authenticated" ON public.iara_violencia FOR SELECT TO authenticated USING (true);

-- Ações penais (consultas A e B unificadas)
CREATE TABLE public.iara_acoes_penais (
  id BIGSERIAL PRIMARY KEY,
  numero TEXT,
  sigilo INTEGER,
  sistema TEXT,
  grau TEXT,
  classe TEXT,
  id_orgao_julgador INTEGER,
  orgao_julgador TEXT,
  procedimento TEXT,
  criminal BOOLEAN,
  data_ajuizamento DATE,
  dt_julgamento DATE,
  dias_sem_tramitacao NUMERIC,
  fonte TEXT NOT NULL DEFAULT 'consultaA'
);
CREATE INDEX idx_acoes_orgao ON public.iara_acoes_penais(orgao_julgador);
CREATE INDEX idx_acoes_classe ON public.iara_acoes_penais(classe);
GRANT SELECT ON public.iara_acoes_penais TO authenticated;
GRANT ALL ON public.iara_acoes_penais TO service_role;
ALTER TABLE public.iara_acoes_penais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acoes_read_authenticated" ON public.iara_acoes_penais FOR SELECT TO authenticated USING (true);

-- Data Hub: status das fontes
CREATE TABLE public.iara_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  status public.iara_source_status NOT NULL DEFAULT 'pendente',
  ultima_sync TIMESTAMPTZ,
  registros BIGINT NOT NULL DEFAULT 0,
  categoria TEXT
);
GRANT SELECT ON public.iara_data_sources TO authenticated;
GRANT ALL ON public.iara_data_sources TO service_role;
ALTER TABLE public.iara_data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds_read_authenticated" ON public.iara_data_sources FOR SELECT TO authenticated USING (true);

INSERT INTO public.iara_data_sources (nome, descricao, status, ultima_sync, registros, categoria) VALUES
('DataJud', 'Base nacional do CNJ — produtividade e estoque', 'conectado', now()-interval '12 minutes', 5713, 'CNJ'),
('SAJ / SG5', 'Sistema de Automação da Justiça (1º grau)', 'conectado', now()-interval '8 minutes', 7234, 'TJAC'),
('PJe', 'Processo Judicial Eletrônico', 'conectado', now()-interval '15 minutes', 2729, 'TJAC'),
('eproc', 'Sistema eproc — feeder unificado de processos eletrônicos', 'sincronizando', now()-interval '3 minutes', 0, 'TJAC'),
('GRP', 'Sistema de gestão administrativa', 'sincronizando', now()-interval '40 minutes', 0, 'Admin'),
('PDPJ', 'Plataforma Digital do Poder Judiciário', 'pendente', NULL, 0, 'CNJ'),
('CNJ API', 'Indicadores oficiais e metas', 'conectado', now()-interval '1 hour', 0, 'CNJ');

-- Alertas
CREATE TABLE public.iara_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  severidade public.iara_alert_severity NOT NULL DEFAULT 'media',
  origem TEXT,
  unidade TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolvido_em TIMESTAMPTZ
);
GRANT SELECT ON public.iara_alertas TO authenticated;
GRANT ALL ON public.iara_alertas TO service_role;
ALTER TABLE public.iara_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alertas_read_authenticated" ON public.iara_alertas FOR SELECT TO authenticated USING (true);

-- Chat (por usuário)
CREATE TABLE public.iara_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_user_time ON public.iara_chat_messages(user_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.iara_chat_messages TO authenticated;
GRANT ALL ON public.iara_chat_messages TO service_role;
ALTER TABLE public.iara_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_self_select" ON public.iara_chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "chat_self_insert" ON public.iara_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_self_delete" ON public.iara_chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
