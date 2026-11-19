-- IEV AVANÇA | Etapa 2: operações, isolamento e histórico
-- Aplicar APÓS 202611170001_initial_access.sql em banco de desenvolvimento.
-- Requer extensão pgcrypto / gen_random_uuid (Supabase já fornece gen_random_uuid).
-- Todas as gravações de agendamentos são realizadas por RPC SECURITY DEFINER.

create table public.agendamentos (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id) on delete restrict,
 responsavel_usuario_id uuid not null references public.usuarios(id) on delete restrict,
 criado_por_usuario_id uuid not null references public.usuarios(id) on delete restrict,
 cliente_nome text not null check (length(btrim(cliente_nome)) >= 2),
 cliente_cpf text not null check (cliente_cpf ~ '^[0-9]{11}$'),
 cliente_telefone text not null check (length(regexp_replace(cliente_telefone, '[^0-9]', '', 'g')) between 10 and 13),
 numero_proposta text not null check (length(btrim(numero_proposta)) > 0),
 data_atendimento date not null,
 hora_atendimento time(0) not null check (extract(minute from hora_atendimento)::integer % 15 = 0 and extract(second from hora_atendimento) = 0),
 status text not null default 'AGENDADO' check (status in ('AGENDADO','EM ATENDIMENTO','DESBLOQUEADO','CLIENTE NÃO ATENDEU','REAGENDADO','CANCELADO')),
 observacoes text,
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
 encerrado_em timestamptz, excluir_apos timestamptz,
 operacao_id uuid not null unique,
 versao integer not null default 1 check (versao > 0)
);
create table public.historico_agendamentos (
 id uuid primary key default gen_random_uuid(), agendamento_id uuid not null references public.agendamentos(id) on delete cascade,
 usuario_id uuid references public.usuarios(id) on delete set null,
 tipo_evento text not null check (tipo_evento in ('CRIACAO','EDICAO','REAGENDAMENTO','STATUS','CANCELAMENTO')),
 dados_anteriores jsonb not null default '{}'::jsonb, dados_novos jsonb not null default '{}'::jsonb,
 justificativa text, criado_em timestamptz not null default now()
);
create table public.tratativas (
 id uuid primary key default gen_random_uuid(), agendamento_id uuid not null references public.agendamentos(id) on delete cascade,
 usuario_id uuid references public.usuarios(id) on delete set null,
 observacao text not null check (length(btrim(observacao)) > 0), criado_em timestamptz not null default now()
);
create table public.notificacoes (
 id uuid primary key default gen_random_uuid(), destinatario_id uuid not null references public.usuarios(id) on delete restrict,
 empresa_id uuid references public.empresas(id) on delete restrict,
 agendamento_id uuid references public.agendamentos(id) on delete set null,
 evento_id uuid not null, tipo_evento text not null, titulo text not null, mensagem text not null,
 lida_em timestamptz, criado_em timestamptz not null default now(), unique(evento_id,destinatario_id)
);
create table public.auditoria (
 id uuid primary key default gen_random_uuid(), usuario_id uuid references public.usuarios(id) on delete set null,
 empresa_id uuid references public.empresas(id) on delete set null, tipo_acao text not null,
 recurso_tipo text not null, recurso_id uuid, justificativa text, resultado text not null default 'SUCESSO',
 criado_em timestamptz not null default now()
);
create table public.estatisticas_diarias (
 id uuid primary key default gen_random_uuid(), data_referencia date not null,
 empresa_id uuid not null references public.empresas(id) on delete restrict,
 responsavel_usuario_id uuid not null references public.usuarios(id) on delete restrict,
 hora_atendimento time(0) not null, status text not null check (status in ('AGENDADO','EM ATENDIMENTO','DESBLOQUEADO','CLIENTE NÃO ATENDEU','REAGENDADO','CANCELADO')),
 quantidade bigint not null default 0 check (quantidade >= 0), atualizado_em timestamptz not null default now(),
 unique(data_referencia, empresa_id, responsavel_usuario_id, hora_atendimento, status)
);
create table public.configuracoes (
 id uuid primary key default gen_random_uuid(), chave text not null unique, valor jsonb not null,
 atualizado_por uuid references public.usuarios(id) on delete set null, atualizado_em timestamptz not null default now()
);
create table public.operacoes_administrativas (
 id uuid primary key default gen_random_uuid(), tipo_operacao text not null,
 solicitante_id uuid references public.usuarios(id) on delete set null,
 recurso_id uuid, justificativa text, situacao text not null check (situacao in ('SOLICITADA','EXECUTADA','FALHOU')),
 criado_em timestamptz not null default now(), concluido_em timestamptz, resultado_referencia text
);
insert into public.configuracoes (chave,valor) values
 ('intervalo_minutos','15'), ('limiar_aviso','5'),('retencao_dias','7'),('paginacao','25'),('timezone','"America/Sao_Paulo"');

create index ag_slot_idx on public.agendamentos(data_atendimento, hora_atendimento, status);
create index ag_empresa_slot_idx on public.agendamentos(empresa_id,data_atendimento,hora_atendimento);
create index ag_empresa_status_idx on public.agendamentos(empresa_id,data_atendimento,status);
create index ag_responsavel_idx on public.agendamentos(responsavel_usuario_id,data_atendimento);
create index ag_cpf_data_idx on public.agendamentos(cliente_cpf,data_atendimento);
create index ag_proposta_idx on public.agendamentos(empresa_id,numero_proposta);
create index ag_expirar_idx on public.agendamentos(excluir_apos) where excluir_apos is not null;
create index hist_ag_data_idx on public.historico_agendamentos(agendamento_id,criado_em);
create index trat_ag_data_idx on public.tratativas(agendamento_id,criado_em);
create index notif_dest_idx on public.notificacoes(destinatario_id,lida_em,criado_em);
create index audit_exp_idx on public.auditoria(criado_em);

alter table public.agendamentos enable row level security;
alter table public.historico_agendamentos enable row level security;
alter table public.tratativas enable row level security;
alter table public.notificacoes enable row level security;
alter table public.auditoria enable row level security;
alter table public.estatisticas_diarias enable row level security;
alter table public.configuracoes enable row level security;
alter table public.operacoes_administrativas enable row level security;
revoke all on public.agendamentos,public.historico_agendamentos,public.tratativas,public.notificacoes,
 public.auditoria,public.estatisticas_diarias,public.configuracoes,public.operacoes_administrativas from anon,authenticated;

-- Sem argumento: papel e estado são sempre obtidos do banco a cada requisição.
create function public.ieva_contexto()
returns table (perfil text, empresa_id uuid)
language sql stable security definer set search_path = '' as $$
 select u.perfil,u.empresa_id from public.usuarios u
 left join public.empresas e on e.id=u.empresa_id
 where u.id=(select auth.uid()) and u.ativo and not u.troca_senha_pendente
   and (u.empresa_id is null or coalesce(e.ativa,false))
 limit 1
$$;
create function public.ieva_pode_ver(p_empresa uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.ieva_contexto() c
 where c.perfil in ('ADMIN_GERAL','DESBLOQUEIO') or (c.empresa_id=p_empresa and c.perfil in ('ADMIN_EMPRESA','PARCEIRO')))
$$;
create function public.ieva_pode_alterar(p_empresa uuid,p_autor uuid,p_operacao text)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.ieva_contexto() c where
 (c.perfil='ADMIN_GERAL' or (c.perfil='ADMIN_EMPRESA' and c.empresa_id=p_empresa)
  or (c.perfil='PARCEIRO' and c.empresa_id=p_empresa and p_autor=(select auth.uid()) and p_operacao in ('EDITAR','REAGENDAR','CANCELAR'))
  or (c.perfil='DESBLOQUEIO' and p_operacao in ('REAGENDAR','CANCELAR','RESULTADO','TRATATIVA')))
 and (c.perfil<>'PARCEIRO' or p_operacao in ('EDITAR','REAGENDAR','CANCELAR'))
 and (c.perfil<>'DESBLOQUEIO' or p_operacao in ('REAGENDAR','CANCELAR','RESULTADO','TRATATIVA')))
$$;

-- Leitura via RLS; permissões de escrita não são concedidas diretamente.
create policy ag_leitura on public.agendamentos for select to authenticated using (public.ieva_pode_ver(empresa_id));
create policy hist_leitura on public.historico_agendamentos for select to authenticated
 using (exists(select 1 from public.agendamentos a where a.id=agendamento_id));
create policy trat_leitura on public.tratativas for select to authenticated
 using (exists(select 1 from public.agendamentos a where a.id=agendamento_id));
create policy notificacao_leitura on public.notificacoes for select to authenticated
 using (destinatario_id=(select auth.uid()) and exists(select 1 from public.ieva_contexto()));
create policy estat_leitura on public.estatisticas_diarias for select to authenticated using
 (exists(select 1 from public.ieva_contexto() c where c.perfil in ('ADMIN_GERAL','DESBLOQUEIO')));
create policy audit_leitura on public.auditoria for select to authenticated using
 (exists(select 1 from public.ieva_contexto() c where c.perfil='ADMIN_GERAL'));

grant select on public.agendamentos,public.historico_agendamentos,public.tratativas,public.notificacoes,
 public.estatisticas_diarias,public.auditoria to authenticated;

-- Suporte: CPF verificado no servidor, nunca confiar apenas na máscara JS.
create function public.ieva_cpf_valido(p_cpf text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare d text; s integer; i integer; x integer;
begin
 d := regexp_replace(coalesce(p_cpf,''),'[^0-9]','','g');
 if length(d)<>11 or d ~ '^([0-9])\1{10}$' then return false; end if;
 s:=0; for i in 1..9 loop s:=s+(substr(d,i,1)::int)*(11-i); end loop;
 x:=(s*10)%11; if x=10 then x:=0; end if;
 if x<>substr(d,10,1)::int then return false; end if;
 s:=0; for i in 1..10 loop s:=s+(substr(d,i,1)::int)*(12-i); end loop;
 x:=(s*10)%11; if x=10 then x:=0; end if;
 return x=substr(d,11,1)::int;
end; $$;
create function public.ieva_letras(p_texto text) returns integer
language sql immutable set search_path = '' as $$
 select char_length(regexp_replace(coalesce(p_texto,''),'[^[:alpha:]]','','g'))
$$;
-- PostgreSQL POSIX [:alpha:] pode variar por collation; ver nota de validação no README.

-- Verifica ocupação GLOBAL sem expor identidades. O advisory lock é compartilhado
-- pela criação e reagendamento de slots, impedindo confirmação defasada.
create function public.ieva_slot_lock(p_data date,p_hora time)
returns void language plpgsql set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_data::text||'T'||p_hora::text, 789));
end; $$;
create function public.ieva_contagem(p_data date,p_hora time)
returns integer language sql stable security definer set search_path = '' as $$
 select count(*)::integer from public.agendamentos
 where data_atendimento=p_data and hora_atendimento=p_hora
 and status in ('AGENDADO','EM ATENDIMENTO','REAGENDADO')
$$;

create function public.ieva_movimentar_estatistica(p_data date,p_empresa uuid,p_autor uuid,p_hora time,p_status text,p_delta integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if p_delta=1 then
  insert into public.estatisticas_diarias(data_referencia,empresa_id,responsavel_usuario_id,hora_atendimento,status,quantidade)
  values(p_data,p_empresa,p_autor,p_hora,p_status,1)
  on conflict(data_referencia,empresa_id,responsavel_usuario_id,hora_atendimento,status)
  do update set quantidade=public.estatisticas_diarias.quantidade+1,atualizado_em=now();
 elsif p_delta=-1 then
  update public.estatisticas_diarias set quantidade=quantidade-1,atualizado_em=now()
  where data_referencia=p_data and empresa_id=p_empresa and responsavel_usuario_id=p_autor and hora_atendimento=p_hora and status=p_status and quantidade>0;
  if not found then raise exception 'Inconsistência no agregado histórico'; end if;
 else raise exception 'Delta estatístico inválido'; end if;
end; $$;
create function public.ieva_notificar(p_ag uuid,p_empresa uuid,p_evento text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_perfil text; v_titulo text; v_evento uuid := gen_random_uuid();
begin
 if p_evento in ('CRIACAO','REAGENDAMENTO') then
  v_perfil:='DESBLOQUEIO';
 else v_perfil:='ADMIN_EMPRESA'; end if;
 v_titulo := case p_evento when 'CRIACAO' then 'Novo agendamento' when 'REAGENDAMENTO' then 'Agendamento reagendado'
 when 'CANCELAMENTO' then 'Agendamento cancelado' else 'Status atualizado' end;
 insert into public.notificacoes(destinatario_id,empresa_id,agendamento_id,evento_id,tipo_evento,titulo,mensagem)
 select u.id,p_empresa,p_ag,v_evento,p_evento,v_titulo,'Consulte os detalhes na Central.'
 from public.usuarios u left join public.empresas e on e.id=u.empresa_id
 where u.perfil=v_perfil and u.ativo and (u.empresa_id is null or e.ativa)
 and (v_perfil='DESBLOQUEIO' or u.empresa_id=p_empresa);
end; $$;

-- Todas as solicitações usam o mesmo status de retorno: OK ou CONFIRMACAO_NECESSARIA.
-- Exigimos confirmação se houver cinco ou mais ocupações no instante da transação.
-- p_contagem_confirmada evita autorizar silenciosamente uma contagem diferente.
create function public.criar_agendamento(
 p_operacao_id uuid,p_empresa_id uuid,p_nome text,p_cpf text,p_telefone text,
 p_proposta text,p_data date,p_hora time,p_observacoes text default null,
 p_confirmar_lotacao boolean default false,p_contagem_confirmada integer default null,
 p_confirmar_duplicidade boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare c record; v_id uuid; v_cpf text; v_qtd integer; v_dup boolean;
begin
 select * into c from public.ieva_contexto() limit 1;
 if c.perfil not in ('ADMIN_GERAL','ADMIN_EMPRESA','PARCEIRO') or c.perfil is null then raise exception 'Acesso negado'; end if;
 if p_empresa_id is null or (c.perfil<>'ADMIN_GERAL' and p_empresa_id is distinct from c.empresa_id)
    or not exists(select 1 from public.empresas e where e.id=p_empresa_id and e.ativa) then raise exception 'Empresa inválida'; end if;
 if p_operacao_id is null then raise exception 'ID da operação obrigatório'; end if;
 -- Serialização por operação também protege retries idempotentes em paralelo.
 perform pg_advisory_xact_lock(hashtextextended(p_operacao_id::text,790));
 select id into v_id from public.agendamentos where operacao_id=p_operacao_id;
 if found then
  if not exists(select 1 from public.agendamentos where id=v_id and criado_por_usuario_id=auth.uid()) then raise exception 'Operação não autorizada'; end if;
  return jsonb_build_object('situacao','OK','id',v_id,'ja_existia',true);
 end if;
 v_cpf:=regexp_replace(coalesce(p_cpf,''),'[^0-9]','','g');
 if not public.ieva_cpf_valido(v_cpf) then raise exception 'CPF inválido'; end if;
 if length(btrim(coalesce(p_nome,'')))<2 or length(btrim(coalesce(p_proposta,'')))<1 then raise exception 'Nome/proposta obrigatórios'; end if;
 if length(regexp_replace(coalesce(p_telefone,''),'[^0-9]','','g')) not between 10 and 13 then raise exception 'Telefone inválido'; end if;
 if p_data is null or p_hora is null or extract(minute from p_hora)::int%15<>0 or extract(second from p_hora)<>0 or
    (p_data+p_hora) <= (now() at time zone 'America/Sao_Paulo') then raise exception 'Data/hora inválida ou passada'; end if;
 perform public.ieva_slot_lock(p_data,p_hora);
 v_qtd:=public.ieva_contagem(p_data,p_hora);
 -- CPF duplicado validado na própria empresa para minimizar dados cross-tenant.
 v_dup:=exists(select 1 from public.agendamentos where empresa_id=p_empresa_id and cliente_cpf=v_cpf and data_atendimento=p_data
  and status <> 'CANCELADO');
 if (v_qtd>=5 and (not p_confirmar_lotacao or p_contagem_confirmada is distinct from v_qtd))
    or (v_dup and not p_confirmar_duplicidade) then
  return jsonb_build_object('situacao','CONFIRMACAO_NECESSARIA','ocupacao',v_qtd,'aviso_lotacao',v_qtd>=5,'cpf_duplicado',v_dup);
 end if;
 insert into public.agendamentos(empresa_id,responsavel_usuario_id,criado_por_usuario_id,cliente_nome,cliente_cpf,
 cliente_telefone,numero_proposta,data_atendimento,hora_atendimento,observacoes,operacao_id)
 values(p_empresa_id,auth.uid(),auth.uid(),btrim(p_nome),v_cpf,btrim(p_telefone),btrim(p_proposta),p_data,p_hora,p_observacoes,p_operacao_id)
 returning id into v_id;
 insert into public.historico_agendamentos(agendamento_id,usuario_id,tipo_evento,dados_novos)
 values(v_id,auth.uid(),'CRIACAO',jsonb_build_object('data',p_data,'hora',p_hora,'status','AGENDADO'));
 perform public.ieva_movimentar_estatistica(p_data,p_empresa_id,auth.uid(),p_hora,'AGENDADO',1);
 perform public.ieva_notificar(v_id,p_empresa_id,'CRIACAO');
 insert into public.auditoria(usuario_id,empresa_id,tipo_acao,recurso_tipo,recurso_id) values(auth.uid(),p_empresa_id,'CRIACAO','AGENDAMENTO',v_id);
 return jsonb_build_object('situacao','OK','id',v_id,'ja_existia',false);
end; $$;

create function public.reagendar_agendamento(p_id uuid,p_versao integer,p_data date,p_hora time,
 p_confirmar_lotacao boolean default false,p_contagem_confirmada integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.agendamentos%rowtype; v_qtd integer;
begin
 -- Lock no registro antes do slot para serializar alterações no mesmo registro.
 select * into a from public.agendamentos where id=p_id for update;
 if not found or not public.ieva_pode_alterar(a.empresa_id,a.criado_por_usuario_id,'REAGENDAR') then raise exception 'Acesso negado'; end if;
 if a.versao is distinct from p_versao then raise exception 'Conflito: registro atualizado por outra pessoa'; end if;
 if a.status not in ('AGENDADO','EM ATENDIMENTO','CLIENTE NÃO ATENDEU','REAGENDADO') then raise exception 'Transição não permitida'; end if;
 if p_data is null or p_hora is null or extract(minute from p_hora)::int%15<>0 or extract(second from p_hora)<>0 or
 (p_data+p_hora) <= (now() at time zone 'America/Sao_Paulo') then raise exception 'Data/hora inválida ou passada'; end if;
 perform public.ieva_slot_lock(p_data,p_hora);
 v_qtd:=public.ieva_contagem(p_data,p_hora);
 if a.status in ('AGENDADO','EM ATENDIMENTO','REAGENDADO') and a.data_atendimento=p_data and a.hora_atendimento=p_hora then v_qtd:=v_qtd-1; end if;
 if v_qtd>=5 and (not p_confirmar_lotacao or p_contagem_confirmada is distinct from v_qtd) then
  return jsonb_build_object('situacao','CONFIRMACAO_NECESSARIA','ocupacao',v_qtd,'aviso_lotacao',true);
 end if;
 perform public.ieva_movimentar_estatistica(a.data_atendimento,a.empresa_id,a.responsavel_usuario_id,a.hora_atendimento,a.status,-1);
 update public.agendamentos set data_atendimento=p_data,hora_atendimento=p_hora,status='REAGENDADO',
 encerrado_em=null,excluir_apos=null,versao=versao+1,atualizado_em=now() where id=p_id;
 perform public.ieva_movimentar_estatistica(p_data,a.empresa_id,a.responsavel_usuario_id,p_hora,'REAGENDADO',1);
 insert into public.historico_agendamentos(agendamento_id,usuario_id,tipo_evento,dados_anteriores,dados_novos)
 values(p_id,auth.uid(),'REAGENDAMENTO',jsonb_build_object('data',a.data_atendimento,'hora',a.hora_atendimento,'status',a.status),
 jsonb_build_object('data',p_data,'hora',p_hora,'status','REAGENDADO'));
 perform public.ieva_notificar(p_id,a.empresa_id,'REAGENDAMENTO');
 insert into public.auditoria(usuario_id,empresa_id,tipo_acao,recurso_tipo,recurso_id) values(auth.uid(),a.empresa_id,'REAGENDAMENTO','AGENDAMENTO',p_id);
 return jsonb_build_object('situacao','OK','id',p_id,'versao',a.versao+1);
end; $$;

create function public.cancelar_agendamento(p_id uuid,p_versao integer,p_justificativa text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.agendamentos%rowtype;
begin
 select * into a from public.agendamentos where id=p_id for update;
 if not found or not public.ieva_pode_alterar(a.empresa_id,a.criado_por_usuario_id,'CANCELAR') then raise exception 'Acesso negado'; end if;
 if a.versao is distinct from p_versao then raise exception 'Conflito de versão'; end if;
 if a.status not in ('AGENDADO','EM ATENDIMENTO','CLIENTE NÃO ATENDEU','REAGENDADO') then raise exception 'Transição não permitida'; end if;
 if public.ieva_letras(p_justificativa)<5 then raise exception 'Justificativa exige no mínimo cinco letras'; end if;
 perform public.ieva_movimentar_estatistica(a.data_atendimento,a.empresa_id,a.responsavel_usuario_id,a.hora_atendimento,a.status,-1);
 update public.agendamentos set status='CANCELADO',encerrado_em=now(),excluir_apos=now()+interval '7 days',versao=versao+1,atualizado_em=now() where id=p_id;
 perform public.ieva_movimentar_estatistica(a.data_atendimento,a.empresa_id,a.responsavel_usuario_id,a.hora_atendimento,'CANCELADO',1);
 insert into public.historico_agendamentos(agendamento_id,usuario_id,tipo_evento,dados_anteriores,dados_novos,justificativa)
 values(p_id,auth.uid(),'CANCELAMENTO',jsonb_build_object('status',a.status),'{"status":"CANCELADO"}',p_justificativa);
 perform public.ieva_notificar(p_id,a.empresa_id,'CANCELAMENTO');
 insert into public.auditoria(usuario_id,empresa_id,tipo_acao,recurso_tipo,recurso_id,justificativa)
 values(auth.uid(),a.empresa_id,'CANCELAMENTO','AGENDAMENTO',p_id,p_justificativa);
 return jsonb_build_object('situacao','OK','id',p_id,'versao',a.versao+1);
end; $$;

create function public.atualizar_resultado_agendamento(p_id uuid,p_versao integer,p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.agendamentos%rowtype; v_ok boolean;
begin
 select * into a from public.agendamentos where id=p_id for update;
 if not found or not public.ieva_pode_alterar(a.empresa_id,a.criado_por_usuario_id,'RESULTADO') then raise exception 'Acesso negado'; end if;
 if a.versao is distinct from p_versao then raise exception 'Conflito de versão'; end if;
 v_ok:=(a.status in ('AGENDADO','REAGENDADO') and p_status='EM ATENDIMENTO')
 or (a.status='EM ATENDIMENTO' and p_status in ('DESBLOQUEADO','CLIENTE NÃO ATENDEU'));
 if not v_ok then raise exception 'Transição não permitida'; end if;
 perform public.ieva_movimentar_estatistica(a.data_atendimento,a.empresa_id,a.responsavel_usuario_id,a.hora_atendimento,a.status,-1);
 update public.agendamentos set status=p_status,versao=versao+1,atualizado_em=now(),
 encerrado_em=case when p_status in ('DESBLOQUEADO','CLIENTE NÃO ATENDEU') then now() else null end,
 excluir_apos=case when p_status in ('DESBLOQUEADO','CLIENTE NÃO ATENDEU') then now()+interval '7 days' else null end where id=p_id;
 perform public.ieva_movimentar_estatistica(a.data_atendimento,a.empresa_id,a.responsavel_usuario_id,a.hora_atendimento,p_status,1);
 insert into public.historico_agendamentos(agendamento_id,usuario_id,tipo_evento,dados_anteriores,dados_novos)
 values(p_id,auth.uid(),'STATUS',jsonb_build_object('status',a.status),jsonb_build_object('status',p_status));
 perform public.ieva_notificar(p_id,a.empresa_id,'STATUS');
 insert into public.auditoria(usuario_id,empresa_id,tipo_acao,recurso_tipo,recurso_id) values(auth.uid(),a.empresa_id,'STATUS','AGENDAMENTO',p_id);
 return jsonb_build_object('situacao','OK','id',p_id,'versao',a.versao+1);
end; $$;

create function public.registrar_tratativa_agendamento(p_id uuid,p_observacao text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.agendamentos%rowtype; v_id uuid;
begin
 select * into a from public.agendamentos where id=p_id;
 if not found or not public.ieva_pode_alterar(a.empresa_id,a.criado_por_usuario_id,'TRATATIVA') then raise exception 'Acesso negado'; end if;
 if length(btrim(coalesce(p_observacao,'')))=0 then raise exception 'Observação obrigatória'; end if;
 insert into public.tratativas(agendamento_id,usuario_id,observacao) values(p_id,auth.uid(),p_observacao) returning id into v_id;
 insert into public.auditoria(usuario_id,empresa_id,tipo_acao,recurso_tipo,recurso_id) values(auth.uid(),a.empresa_id,'TRATATIVA','AGENDAMENTO',p_id);
 return v_id;
end; $$;

create function public.marcar_notificacao_lida(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.ieva_contexto()) then raise exception 'Acesso negado'; end if;
 update public.notificacoes set lida_em=coalesce(lida_em,now()) where id=p_id and destinatario_id=auth.uid();
 return found;
end; $$;

-- Procedimentos de retenção e exclusão somente acessíveis por job privilegiado.
-- A exclusão não altera estatísticas: a intenção é preservar agregados históricos.
create function public.ieva_limpeza_retencao(p_lote integer default 500)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ag integer; v_audit integer;
begin
 if session_user not in ('postgres','service_role') then raise exception 'Execução administrativa apenas'; end if;
 if p_lote<1 or p_lote>5000 then raise exception 'Lote fora de faixa'; end if;
 with alvos as (select id from public.agendamentos
    where excluir_apos<=now() and status in ('DESBLOQUEADO','CANCELADO','CLIENTE NÃO ATENDEU')
    order by excluir_apos limit p_lote for update skip locked),
 apagados as (delete from public.agendamentos where id in (select id from alvos) returning id)
 select count(*) into v_ag from apagados;
 with alvos as (select id from public.auditoria where criado_em<now()-interval '7 days' order by criado_em limit p_lote),
 apagados as (delete from public.auditoria where id in (select id from alvos) returning id)
 select count(*) into v_audit from apagados;
 return jsonb_build_object('agendamentos_excluidos',v_ag,'auditorias_excluidas',v_audit);
end; $$;

-- Em Supabase, PUBLIC possui EXECUTE por padrão em funções novas.
-- Revogar funções auxiliares antes de conceder apenas a API necessária.
revoke all on function public.ieva_contexto(),public.ieva_pode_ver(uuid),public.ieva_pode_alterar(uuid,uuid,text),
 public.ieva_cpf_valido(text),public.ieva_letras(text),public.ieva_slot_lock(date,time),public.ieva_contagem(date,time),
 public.ieva_movimentar_estatistica(date,uuid,uuid,time,text,integer),public.ieva_notificar(uuid,uuid,text),
 public.criar_agendamento(uuid,uuid,text,text,text,text,date,time,text,boolean,integer,boolean),
 public.reagendar_agendamento(uuid,integer,date,time,boolean,integer),public.cancelar_agendamento(uuid,integer,text),
 public.atualizar_resultado_agendamento(uuid,integer,text),public.registrar_tratativa_agendamento(uuid,text),
 public.marcar_notificacao_lida(uuid),public.ieva_limpeza_retencao(integer)
 from public,anon,authenticated;
grant execute on function public.criar_agendamento(uuid,uuid,text,text,text,text,date,time,text,boolean,integer,boolean),
 public.reagendar_agendamento(uuid,integer,date,time,boolean,integer),public.cancelar_agendamento(uuid,integer,text),
 public.atualizar_resultado_agendamento(uuid,integer,text),public.registrar_tratativa_agendamento(uuid,text),
 public.marcar_notificacao_lida(uuid) to authenticated;
-- IMPORTANT: ieva_contexto e ieva_pode_ver são SECURITY DEFINER e podem ser chamados
-- por políticas mesmo sem EXECUTE do usuário final, conforme execução do owner.

-- A RLS precisa poder executar estes predicados; ambos só devolvem contexto
-- do próprio autenticado ou um booleano de escopo, sem dados de clientes.
grant execute on function public.ieva_contexto(),public.ieva_pode_ver(uuid) to authenticated;
