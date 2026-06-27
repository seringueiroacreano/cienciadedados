
-- Admin-only writes on iara_alertas
CREATE POLICY "Admins manage alerts insert" ON public.iara_alertas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage alerts update" ON public.iara_alertas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage alerts delete" ON public.iara_alertas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admin-only writes on iara_data_sources
CREATE POLICY "Admins manage data sources insert" ON public.iara_data_sources FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage data sources update" ON public.iara_data_sources FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage data sources delete" ON public.iara_data_sources FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admin-only writes on iara_knowledge_base
CREATE POLICY "Admins manage kb insert" ON public.iara_knowledge_base FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage kb update" ON public.iara_knowledge_base FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage kb delete" ON public.iara_knowledge_base FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Restrict iara_violencia reads to admin/magistrado
DROP POLICY IF EXISTS "Authenticated can read violencia" ON public.iara_violencia;
DROP POLICY IF EXISTS "Authenticated read violencia" ON public.iara_violencia;
DROP POLICY IF EXISTS "iara_violencia_select" ON public.iara_violencia;
DROP POLICY IF EXISTS "Read violencia" ON public.iara_violencia;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='iara_violencia' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.iara_violencia', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Restricted read violencia" ON public.iara_violencia FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'magistrado'));
