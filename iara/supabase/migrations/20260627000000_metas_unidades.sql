-- Metas Nacionais do CNJ (Meta 1 e Meta 2) e catálogo de Unidades Judiciais do TJAC
-- Dados de origem: Metas_Nacionais_SAJ (meta_01/meta_02) e Unidades_Judiciais_TJAC

CREATE TABLE IF NOT EXISTS public.iara_unidades_judiciais (
  id BIGSERIAL PRIMARY KEY,
  unidade TEXT NOT NULL,
  grau TEXT,
  arquivos BIGINT NOT NULL DEFAULT 0,
  UNIQUE (unidade, grau)
);
GRANT SELECT ON public.iara_unidades_judiciais TO authenticated;
GRANT ALL ON public.iara_unidades_judiciais TO service_role;
GRANT INSERT, SELECT, DELETE ON public.iara_unidades_judiciais TO sandbox_exec;
GRANT USAGE ON SEQUENCE public.iara_unidades_judiciais_id_seq TO sandbox_exec;
ALTER TABLE public.iara_unidades_judiciais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unidades_read_auth" ON public.iara_unidades_judiciais FOR SELECT TO authenticated USING (true);

-- Meta 1 CNJ: julgar quantidade igual/superior à de casos novos no ano.
-- Granularidade: evento por processo (Casos Novos | Julgados | Pendentes | Suspensos).
CREATE TABLE IF NOT EXISTS public.iara_meta1_eventos (
  id BIGSERIAL PRIMARY KEY,
  id_processo BIGINT,
  grau TEXT NOT NULL,
  classe TEXT,
  nome_natureza TEXT,
  id_orgao_julgador BIGINT,
  nome_orgao_julgador TEXT,
  nome_municipio TEXT,
  flg_juizo_100_digital TEXT,
  dt_evento DATE NOT NULL,
  var TEXT NOT NULL,
  sistema TEXT
);
CREATE INDEX IF NOT EXISTS idx_meta1_ano ON public.iara_meta1_eventos((date_part('year', dt_evento)));
CREATE INDEX IF NOT EXISTS idx_meta1_grau ON public.iara_meta1_eventos(grau);
CREATE INDEX IF NOT EXISTS idx_meta1_unidade ON public.iara_meta1_eventos(nome_orgao_julgador);
CREATE INDEX IF NOT EXISTS idx_meta1_var ON public.iara_meta1_eventos(var);
GRANT SELECT ON public.iara_meta1_eventos TO authenticated;
GRANT ALL ON public.iara_meta1_eventos TO service_role;
GRANT INSERT, SELECT, DELETE ON public.iara_meta1_eventos TO sandbox_exec;
GRANT USAGE ON SEQUENCE public.iara_meta1_eventos_id_seq TO sandbox_exec;
ALTER TABLE public.iara_meta1_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta1_read_auth" ON public.iara_meta1_eventos FOR SELECT TO authenticated USING (true);

-- Meta 2 CNJ: julgar percentual de processos distribuídos até o ano-base (acervo antigo).
CREATE TABLE IF NOT EXISTS public.iara_meta2_eventos (
  id BIGSERIAL PRIMARY KEY,
  id_processo BIGINT,
  grau TEXT NOT NULL,
  classe TEXT,
  nome_natureza TEXT,
  id_orgao_julgador BIGINT,
  nome_orgao_julgador TEXT,
  nome_municipio TEXT,
  flg_juizo_100_digital TEXT,
  dt_evento DATE NOT NULL,
  var TEXT NOT NULL,
  sistema TEXT
);
CREATE INDEX IF NOT EXISTS idx_meta2_ano ON public.iara_meta2_eventos((date_part('year', dt_evento)));
CREATE INDEX IF NOT EXISTS idx_meta2_grau ON public.iara_meta2_eventos(grau);
CREATE INDEX IF NOT EXISTS idx_meta2_unidade ON public.iara_meta2_eventos(nome_orgao_julgador);
CREATE INDEX IF NOT EXISTS idx_meta2_var ON public.iara_meta2_eventos(var);
GRANT SELECT ON public.iara_meta2_eventos TO authenticated;
GRANT ALL ON public.iara_meta2_eventos TO service_role;
GRANT INSERT, SELECT, DELETE ON public.iara_meta2_eventos TO sandbox_exec;
GRANT USAGE ON SEQUENCE public.iara_meta2_eventos_id_seq TO sandbox_exec;
ALTER TABLE public.iara_meta2_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta2_read_auth" ON public.iara_meta2_eventos FOR SELECT TO authenticated USING (true);

INSERT INTO public.iara_data_sources (nome, descricao, status, ultima_sync, registros, categoria) VALUES
('Metas Nacionais SAJ · Meta 1', 'Casos novos, julgados e pendentes — Meta 1 CNJ', 'conectado', now(), 81497, 'CNJ'),
('Metas Nacionais SAJ · Meta 2', 'Distribuídos, julgados e acervo antigo — Meta 2 CNJ', 'conectado', now(), 79547, 'CNJ'),
('Unidades Judiciais TJAC', 'Catálogo de varas, turmas e juizados do TJAC', 'conectado', now(), 181, 'TJAC')
ON CONFLICT (nome) DO UPDATE SET status = EXCLUDED.status, ultima_sync = EXCLUDED.ultima_sync, registros = EXCLUDED.registros;
