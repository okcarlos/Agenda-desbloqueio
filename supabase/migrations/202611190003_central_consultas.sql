-- Etapa 3: consultas mínimas para preencher interface sem abrir tabelas de identidade.
-- Aplicar depois das migrações 001 e 002, em projeto de desenvolvimento.
create function public.ieva_empresas_visiveis()
returns table (id uuid, nome text)
language sql stable security definer set search_path = '' as $$
 select e.id, e.nome from public.empresas e
 where e.ativa and exists (
  select 1 from public.ieva_contexto() c
  where c.perfil = 'ADMIN_GERAL'
    or (c.perfil in ('ADMIN_EMPRESA','PARCEIRO','DESBLOQUEIO')
      and (c.perfil='DESBLOQUEIO' or c.empresa_id=e.id))
 ) order by e.nome
$$;

create function public.ieva_usuarios_visiveis(p_empresa uuid default null)
returns table (id uuid, nome text, empresa_id uuid)
language sql stable security definer set search_path = '' as $$
 select u.id,u.nome,u.empresa_id from public.usuarios u
 join public.empresas e on e.id=u.empresa_id
 where u.ativo and e.ativa
  and (p_empresa is null or u.empresa_id=p_empresa)
  and exists (select 1 from public.ieva_contexto() c
   where c.perfil in ('ADMIN_GERAL','DESBLOQUEIO')
      or (c.perfil in ('ADMIN_EMPRESA','PARCEIRO') and c.empresa_id=u.empresa_id))
 order by u.nome
$$;
revoke all on function public.ieva_empresas_visiveis(), public.ieva_usuarios_visiveis(uuid) from public, anon;
grant execute on function public.ieva_empresas_visiveis(), public.ieva_usuarios_visiveis(uuid) to authenticated;
