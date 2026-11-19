-- Etapa 6: resumo mensal (sem PII) e rotina administrativa de retenção.
-- Executar somente depois das migrações 001 a 005.
begin;

create or replace function public.ieva_resumo_calendario(
 p_inicio date, p_fim date, p_empresa uuid default null,
 p_responsavel uuid default null, p_status text default null
)
returns table (dia date, status text, quantidade bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
 if not exists (select 1 from public.ieva_contexto()) then
  raise exception 'Acesso negado' using errcode='42501';
 end if;
 if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim-p_inicio > 31 then
  raise exception 'Intervalo de calendário inválido';
 end if;
 return query
 select a.data_atendimento, a.status, count(*)::bigint
 from public.agendamentos a
 where a.data_atendimento between p_inicio and p_fim
 and (p_empresa is null or a.empresa_id=p_empresa)
 and (p_responsavel is null or a.responsavel_usuario_id=p_responsavel)
 and (p_status is null or a.status=p_status)
 group by a.data_atendimento,a.status
 order by a.data_atendimento,a.status;
end $$;
revoke all on function public.ieva_resumo_calendario(date,date,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ieva_resumo_calendario(date,date,uuid,uuid,text) to authenticated;

-- Função wrapper: log operacional sem CPF/PII e sem acesso de perfis comuns.
create or replace function public.ieva_executar_retencao()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_id uuid;
begin
 if session_user not in ('postgres','service_role') then
   raise exception 'Execução privilegiada apenas' using errcode='42501';
 end if;
 insert into public.operacoes_administrativas(tipo_operacao,situacao)
 values ('RETENCAO_AUTOMATICA','SOLICITADA') returning id into v_id;
 begin
  v_result:=public.ieva_limpeza_retencao(500);
  update public.operacoes_administrativas
  set situacao='EXECUTADA', concluido_em=now(), resultado_referencia=v_result::text
  where id=v_id;
 exception when others then
  update public.operacoes_administrativas
  set situacao='FALHOU', concluido_em=now(), resultado_referencia=left(sqlerrm,400)
  where id=v_id;
  raise warning 'Retenção IEV falhou; consulte o log administrativo';
  return jsonb_build_object('situacao','FALHOU');
 end;
 return v_result;
end $$;
revoke all on function public.ieva_executar_retencao() from public,anon,authenticated;
commit;

-- ATIVAÇÃO DO CRON (separada, após verificar pg_cron na instância):
-- create extension if not exists pg_cron with schema pg_catalog;
-- select cron.schedule('ieva-retencao-diaria','10 3 * * *',
--   $$select public.ieva_executar_retencao();$$);
-- NÃO execute repetidamente sem conferir cron.job.
-- O agendamento Cron pode usar UTC; confirme no painel antes da ativação.
