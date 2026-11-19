-- Etapa 4: aplicar apos 001, 002 e 003, somente em ambiente de desenvolvimento primeiro.
-- Regras: nenhum INSERT/UPDATE direto nas tabelas pelos clientes.

create function public.ieva_dashboard(p_inicio date default null,p_fim date default null,p_empresa uuid default null,p_responsavel uuid default null,p_status text default null,p_hora time default null)
returns table (status text, quantidade bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not exists (select 1 from public.ieva_contexto() c where c.perfil in ('ADMIN_GERAL','DESBLOQUEIO')) then
  raise exception 'Acesso negado ao Dashboard' using errcode='42501';
 end if;
 return query select s.status,coalesce(sum(s.quantidade),0)::bigint
 from public.estatisticas_diarias s
 where (p_inicio is null or s.data_referencia>=p_inicio)
   and (p_fim is null or s.data_referencia<=p_fim)
   and (p_empresa is null or s.empresa_id=p_empresa)
   and (p_responsavel is null or s.responsavel_usuario_id=p_responsavel)
   and (p_status is null or s.status=p_status)
   and (p_hora is null or s.hora_atendimento=p_hora)
 group by s.status;
end $$;

create function public.ieva_listar_empresas_admin()
returns table(id uuid,nome text,responsavel_nome text,telefone text,email text,ativa boolean,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.ieva_contexto() c where c.perfil='ADMIN_GERAL') then raise exception 'Acesso negado' using errcode='42501'; end if;
 return query select e.id,e.nome,e.responsavel_nome,e.telefone,e.email,e.ativa,e.criado_em from public.empresas e order by e.nome;
end $$;

create function public.ieva_salvar_empresa(p_id uuid,p_nome text,p_responsavel text default null,p_telefone text default null,p_email text default null,p_ativa boolean default true)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not exists(select 1 from public.ieva_contexto() c where c.perfil='ADMIN_GERAL') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if length(btrim(coalesce(p_nome,'')))<2 then raise exception 'Nome da empresa inválido'; end if;
 if p_id is null then
   insert into public.empresas(nome,responsavel_nome,telefone,email,ativa,criado_por)
   values(btrim(p_nome),nullif(btrim(p_responsavel),''),nullif(btrim(p_telefone),''),nullif(btrim(p_email),''),coalesce(p_ativa,true),auth.uid()) returning id into v_id;
 else
   update public.empresas set nome=btrim(p_nome),responsavel_nome=nullif(btrim(p_responsavel),''),telefone=nullif(btrim(p_telefone),''),email=nullif(btrim(p_email),''),ativa=coalesce(p_ativa,true)
   where id=p_id returning id into v_id;
   if v_id is null then raise exception 'Empresa não encontrada'; end if;
 end if;
 insert into public.auditoria(usuario_id,empresa_id,tipo_acao,recurso_tipo,recurso_id)
 values(auth.uid(),v_id,case when p_id is null then 'EMPRESA_CRIADA' else 'EMPRESA_ATUALIZADA' end,'EMPRESA',v_id);
 return v_id;
end $$;

create function public.ieva_listar_usuarios_admin()
returns table(id uuid,nome text,email text,perfil text,empresa_id uuid,empresa_nome text,ativo boolean,troca_senha_pendente boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_perfil text; v_empresa uuid;
begin
 select c.perfil,c.empresa_id into v_perfil,v_empresa from public.ieva_contexto() c;
 if v_perfil not in ('ADMIN_GERAL','ADMIN_EMPRESA') or v_perfil is null then raise exception 'Acesso negado' using errcode='42501'; end if;
 return query select u.id,u.nome,u.email,u.perfil,u.empresa_id,e.nome,u.ativo,u.troca_senha_pendente
 from public.usuarios u left join public.empresas e on e.id=u.empresa_id
 where v_perfil='ADMIN_GERAL' or (u.empresa_id=v_empresa and u.perfil='PARCEIRO') order by u.nome;
end $$;

create function public.ieva_atualizar_usuario_admin(p_id uuid,p_nome text,p_ativo boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_perfil text;v_empresa uuid;v_alvo public.usuarios%rowtype;
begin
 select c.perfil,c.empresa_id into v_perfil,v_empresa from public.ieva_contexto() c;
 if v_perfil not in ('ADMIN_GERAL','ADMIN_EMPRESA') or v_perfil is null then raise exception 'Acesso negado' using errcode='42501'; end if;
 select * into v_alvo from public.usuarios where id=p_id for update;
 if not found then raise exception 'Usuário não encontrado'; end if;
 if v_perfil='ADMIN_EMPRESA' and (v_alvo.perfil<>'PARCEIRO' or v_alvo.empresa_id is distinct from v_empresa) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_id=auth.uid() and p_ativo=false then raise exception 'Não é permitido desativar a própria conta'; end if;
 if length(btrim(coalesce(p_nome,'')))<2 then raise exception 'Nome inválido'; end if;
 update public.usuarios set nome=btrim(p_nome),ativo=p_ativo where id=p_id;
 insert into public.auditoria(usuario_id,empresa_id,tipo_acao,recurso_tipo,recurso_id)
 values(auth.uid(),v_alvo.empresa_id,'USUARIO_ATUALIZADO','USUARIO',p_id);
 return true;
end $$;

-- Reforça que nenhum usuário possa ler outros destinatários por tabela.
-- A política notificacao_leitura de 002 já limita leitura ao destinatário.
revoke all on function public.ieva_dashboard(date,date,uuid,uuid,text,time),public.ieva_listar_empresas_admin(),public.ieva_salvar_empresa(uuid,text,text,text,text,boolean),public.ieva_listar_usuarios_admin(),public.ieva_atualizar_usuario_admin(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.ieva_dashboard(date,date,uuid,uuid,text,time),public.ieva_listar_empresas_admin(),public.ieva_salvar_empresa(uuid,text,text,text,text,boolean),public.ieva_listar_usuarios_admin(),public.ieva_atualizar_usuario_admin(uuid,text,boolean) to authenticated;
