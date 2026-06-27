
CREATE TABLE IF NOT EXISTS public.iara_knowledge_base (
  id bigserial PRIMARY KEY,
  source text NOT NULL,
  title text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iara_knowledge_base TO authenticated;
GRANT ALL ON public.iara_knowledge_base TO service_role;
GRANT INSERT, SELECT, DELETE ON public.iara_knowledge_base TO sandbox_exec;
GRANT USAGE ON SEQUENCE public.iara_knowledge_base_id_seq TO sandbox_exec;
ALTER TABLE public.iara_knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_read_auth" ON public.iara_knowledge_base FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_kb_source ON public.iara_knowledge_base(source);
