
ALTER TABLE public.iara_tcl_monthly
  ALTER COLUMN quantidade_pendentes DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS quantidade_remetidos_ent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_remetidos_saida integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_novos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_remetidos_ent_12m numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_remetidos_saida_12m numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_novos_12m numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.iara_processos_baixados (
  id bigserial PRIMARY KEY,
  id_grau text,
  ano_mes integer,
  numero text,
  sigilo integer,
  sistema text,
  grau text,
  id_classe integer,
  classe text,
  id_orgao_julgador integer,
  orgao_julgador text,
  dt_evento date,
  procedimento text,
  novo boolean,
  criminal boolean
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iara_processos_baixados TO authenticated;
GRANT ALL ON public.iara_processos_baixados TO service_role;
ALTER TABLE public.iara_processos_baixados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "baixados_read_auth" ON public.iara_processos_baixados FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_baixados_anomes ON public.iara_processos_baixados(ano_mes);
CREATE INDEX IF NOT EXISTS idx_baixados_orgao ON public.iara_processos_baixados(id_orgao_julgador);

CREATE TABLE IF NOT EXISTS public.iara_processos_novos (
  id bigserial PRIMARY KEY,
  id_grau text,
  ano_mes integer,
  numero text,
  sigilo integer,
  sistema text,
  grau text,
  id_classe integer,
  classe text,
  id_orgao_julgador integer,
  orgao_julgador text,
  dt_evento date,
  procedimento text,
  novo boolean,
  criminal boolean
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iara_processos_novos TO authenticated;
GRANT ALL ON public.iara_processos_novos TO service_role;
ALTER TABLE public.iara_processos_novos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "novos_read_auth" ON public.iara_processos_novos FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_novos_anomes ON public.iara_processos_novos(ano_mes);
CREATE INDEX IF NOT EXISTS idx_novos_orgao ON public.iara_processos_novos(id_orgao_julgador);

CREATE TABLE IF NOT EXISTS public.iara_processos_recebidos (
  id bigserial PRIMARY KEY,
  grau text,
  numero text,
  id_orgao_julgador integer,
  orgao_julgador text,
  dt_evento date,
  anomes integer
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iara_processos_recebidos TO authenticated;
GRANT ALL ON public.iara_processos_recebidos TO service_role;
ALTER TABLE public.iara_processos_recebidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recebidos_read_auth" ON public.iara_processos_recebidos FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_recebidos_anomes ON public.iara_processos_recebidos(anomes);
CREATE INDEX IF NOT EXISTS idx_recebidos_orgao ON public.iara_processos_recebidos(id_orgao_julgador);
