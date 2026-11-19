-- OPCIONAL / EXECUTE SEPARADAMENTE NO SQL EDITOR DO SUPABASE.
-- Conferir se pg_cron está disponível no projeto e se o fuso do cron está correto.
create extension if not exists pg_cron with schema pg_catalog;
-- Não duplicar o job se ele já estiver ativo:
select jobid, jobname, schedule, command from cron.job where jobname='ieva-retencao-diaria';
-- Execute a linha abaixo somente se a consulta acima NÃO retornar job ativo:
-- select cron.schedule('ieva-retencao-diaria','10 3 * * *', $$select public.ieva_executar_retencao();$$);
-- Verificar execução em cron.job_run_details e a tabela operacoes_administrativas.
