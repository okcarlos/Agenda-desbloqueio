-- IEV Avança — edição segura de perfil e vínculo empresarial.
-- Aplicar uma vez após as migrações 001-006, preferencialmente em homologação.
-- A função é destinada SOMENTE ao Administrador geral ativo, com senha definitiva.
BEGIN;

CREATE FUNCTION public.ieva_alterar_usuario_geral(
  p_id uuid,
  p_nome text,
  p_ativo boolean,
  p_perfil text,
  p_empresa_id uuid,
  p_perfil_esperado text,
  p_empresa_esperada uuid,
  p_justificativa text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_alvo public.usuarios%ROWTYPE;
  v_empresa_ativa boolean;
  v_mudou_perfil boolean;
  v_mudou_empresa boolean;
  v_mudou_privilegios boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ieva_contexto() c WHERE c.perfil = 'ADMIN_GERAL'
  ) THEN
    RAISE EXCEPTION 'Somente o Administrador geral pode alterar perfis' USING ERRCODE = '42501';
  END IF;

  -- Serializa mudanças de privilégios (inclusive último administrador ativo).
  PERFORM pg_catalog.pg_advisory_xact_lock(726331007);

  SELECT * INTO v_alvo FROM public.usuarios WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF v_alvo.perfil IS DISTINCT FROM p_perfil_esperado
     OR v_alvo.empresa_id IS DISTINCT FROM p_empresa_esperada THEN
    RAISE EXCEPTION 'O usuário foi alterado por outra sessão. Recarregue a lista.' USING ERRCODE='40001';
  END IF;

  IF p_perfil NOT IN ('ADMIN_GERAL','ADMIN_EMPRESA','PARCEIRO','DESBLOQUEIO') OR p_perfil IS NULL THEN
    RAISE EXCEPTION 'Perfil inválido';
  END IF;
  IF p_ativo IS NULL OR pg_catalog.length(pg_catalog.btrim(COALESCE(p_nome,''))) < 2 THEN
    RAISE EXCEPTION 'Nome ou situação inválidos';
  END IF;

  IF p_perfil IN ('ADMIN_GERAL','DESBLOQUEIO') THEN
    IF p_empresa_id IS NOT NULL THEN RAISE EXCEPTION 'Perfil global não pode estar vinculado a empresa'; END IF;
  ELSE
    IF p_empresa_id IS NULL THEN RAISE EXCEPTION 'Empresa é obrigatória para este perfil'; END IF;
    SELECT e.ativa INTO v_empresa_ativa FROM public.empresas e WHERE e.id=p_empresa_id;
    IF COALESCE(v_empresa_ativa,false) = false THEN
      RAISE EXCEPTION 'Empresa inexistente ou inativa';
    END IF;
  END IF;

  v_mudou_perfil := v_alvo.perfil IS DISTINCT FROM p_perfil;
  v_mudou_empresa := v_alvo.empresa_id IS DISTINCT FROM p_empresa_id;
  v_mudou_privilegios := v_mudou_perfil OR v_mudou_empresa;

  IF p_id = auth.uid() AND (v_mudou_privilegios OR p_ativo = false) THEN
    RAISE EXCEPTION 'Não é permitido alterar o próprio perfil/vínculo ou desativar a própria conta' USING ERRCODE='42501';
  END IF;

  -- Impede mover registros de autoria histórica para outra empresa por troca de vínculo.
  -- Promoção para papel global mantém o vínculo histórico nos registros operacionais.
  IF v_mudou_empresa AND p_empresa_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.agendamentos a
       WHERE a.responsavel_usuario_id=p_id OR a.criado_por_usuario_id=p_id
       UNION ALL
       SELECT 1 FROM public.estatisticas_diarias s WHERE s.responsavel_usuario_id=p_id
     ) THEN
    RAISE EXCEPTION 'Usuário com agendamentos ou indicadores vinculados não pode mudar de empresa. Desative e crie outra conta para a nova empresa.' USING ERRCODE='42501';
  END IF;

  IF v_alvo.perfil = 'ADMIN_GERAL' AND v_alvo.ativo
     AND (p_perfil <> 'ADMIN_GERAL' OR p_ativo = false) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.perfil='ADMIN_GERAL' AND u.ativo AND u.id <> p_id
        AND NOT u.troca_senha_pendente
    ) THEN
      RAISE EXCEPTION 'Não é permitido remover o último Administrador geral operacional' USING ERRCODE='42501';
    END IF;
  END IF;

  IF v_mudou_privilegios AND pg_catalog.length(pg_catalog.btrim(COALESCE(p_justificativa,''))) < 10 THEN
    RAISE EXCEPTION 'Informe uma justificativa de pelo menos 10 caracteres para alterar perfil ou empresa';
  END IF;

  UPDATE public.usuarios
  SET nome = pg_catalog.btrim(p_nome), ativo = p_ativo,
      perfil = p_perfil, empresa_id = p_empresa_id
  WHERE id = p_id;

  INSERT INTO public.auditoria(usuario_id,empresa_id,tipo_acao,recurso_tipo,recurso_id,justificativa)
  VALUES (
    auth.uid(),v_alvo.empresa_id,
    CASE WHEN v_mudou_privilegios THEN 'USUARIO_PERFIL_ALTERADO' ELSE 'USUARIO_ATUALIZADO' END,
    'USUARIO',p_id,
    CASE WHEN v_mudou_privilegios THEN
      pg_catalog.format('Perfil: %s -> %s; Empresa alterada: %s. Motivo: %s',
        v_alvo.perfil,p_perfil, v_mudou_empresa, pg_catalog.btrim(p_justificativa))
    ELSE NULL END
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.ieva_alterar_usuario_geral(uuid,text,boolean,text,uuid,text,uuid,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ieva_alterar_usuario_geral(uuid,text,boolean,text,uuid,text,uuid,text)
TO authenticated;
COMMENT ON FUNCTION public.ieva_alterar_usuario_geral(uuid,text,boolean,text,uuid,text,uuid,text)
IS 'Edição administrativa de perfis, empresa e situação. Valida ator no banco e audita alterações.';

COMMIT;
