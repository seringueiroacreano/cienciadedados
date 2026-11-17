-- Funções de gatilho não devem ser chamáveis pela API (/rest/v1/rpc/...).
-- meu_papel() e registrar_evento() continuam liberadas de propósito:
--   meu_papel devolve apenas o perfil do próprio usuário; registrar_evento valida a ação e exige perfil ativo.
revoke execute on function public.audita(), public.novo_usuario(), public.recalcula_emenda(),
  public.protege_admin(), public.toca_atualizado(), public.gera_protocolo() from authenticated, anon, public;
