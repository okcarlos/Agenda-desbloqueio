-- ETAPA 5A: múltiplos agendamentos com mesmo CPF e status personalizados.
-- Execute APÓS 001, 002, 003 e 004 em ambiente de testes.
-- Status padrão permanecem imutáveis. Personalizados possuem nomes únicos sem colisão.
begin;

create table public.status_personalizados (
 id uuid primary key default gen_random_uuid(),
 nome text not null unique,
 cor text not null check (cor ~ '^#[0-9A-Fa-f]{6}$'),
 comportamento text not null check (comportamento in ('ATIVO','CONCLUIDO','ENCERRADO')),
 ocupa_horario boolean not null default false,
 -- Origens autorizadas. Só podem ser status operacionais não-terminais.
 origens text[] not null default array['AGENDADO','EM ATENDIMENTO','REAGENDADO']::text[],
 ativo boolean not null default true,
 criado_por uuid references public.usuarios(id) on delete set null,
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 constraint status_nome_valido check (char_length(btrim(nome)) between 3 and 50),
 constraint status_sem_padrao check (nome not in ('AGENDADO','EM ATENDIMENTO','DESBLOQUEADO','CLIENTE NÃO ATENDEU','REAGENDADO','CANCELADO')),
 constraint status_ocupacao_ativa check (not ocupa_horario or comportamento='ATIVO'),
 constraint status_origens_sem_nulo check (array_position(origens, null) is null),
 constraint status_origens_validas check (origens <@ array['AGENDADO','EM ATENDIMENTO','REAGENDADO']::text[])
);
create index status_personalizados_ativo_idx on public.status_personalizados(ativo);
alter table public.status_personalizados enable row level security;
revoke all on public.status_personalizados from anon, authenticated;

-- Os dados do catálogo são públicos apenas aos usuários operacionais autenticados e ativos.
create policy status_catalogo_leitura on public.status_personalizados
 for select to authenticated using (exists(select 1 from public.ieva_contexto()));
grant select on public.status_personalizados to authenticated;

-- Restrições antigas eram fechadas em seis valores.
alter table public.agendamentos drop constraint if exists agendamentos_status_check;
alter table public.estatisticas_diarias drop constraint if exists estatisticas_diarias_status_check;
-- Um trigger valida o status contra o catálogo. A estatística histórica não usa FK
-- porque mantém agregados mesmo após a desativação do status.
create function public.ieva_validar_status_agendamento() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status not in ('AGENDADO','EM ATENDIMENTO','DESBLOQUEADO','CLIENTE NÃO ATENDEU','REAGENDADO','CANCELADO')
 and not exists(select 1 from public.status_personalizados s where s.nome=new.status) then
  raise exception 'Status desconhecido';
 end if;
 return new;
end $$;
create trigger validar_status_agendamento before insert or update of status on public.agendamentos
 for each row execute function public.ieva_validar_status_agendamento();

-- Usado pelas funções de contagem; status padrão sempre seguem as regras originais.
create or replace function public.ieva_status_ocupa(p_status text) returns boolean
language sql stable security definer set search_path='' as $$
 select case when p_status in ('AGENDADO','EM ATENDIMENTO','REAGENDADO') then true
 when p_status in ('DESBLOQUEADO','CLIENTE NÃO ATENDEU','CANCELADO') then false
 else coalesce((select s.ocupa_horario from public.status_personalizados s where s.nome=p_status),false) end
$$;
create or replace function public.ieva_contagem(p_data date,p_hora time)
returns integer language sql stable security definer set search_path='' as $$
 select count(*)::integer from public.agendamentos a
 where a.data_atendimento=p_data and a.hora_atendimento=p_hora and public.ieva_status_ocupa(a.status)
$$;

-- CATÁLOGO: somente Admin. geral pode criar/alterar; regras verificadas no banco.
create function public.ieva_salvar_status(
 p_id uuid, p_nome text, p_cor text, p_comportamento text,
 p_ocupa_horario boolean, p_origens text[], p_ativo boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_old public.status_personalizados%rowtype;
begin
 if not exists(select 1 from public.ieva_contexto() c where c.perfil='ADMIN_GERAL') then
  raise exception 'Acesso negado' using errcode='42501';
 end if;
 if p_nome is null or char_length(btrim(p_nome)) not between 3 and 50
 or btrim(p_nome) in ('AGENDADO','EM ATENDIMENTO','DESBLOQUEADO','CLIENTE NÃO ATENDEU','REAGENDADO','CANCELADO')
 or p_cor is null or p_cor !~ '^#[0-9A-Fa-f]{6}$'
 or p_comportamento is null or p_comportamento not in ('ATIVO','CONCLUIDO','ENCERRADO')
 or p_ocupa_horario is null or (p_ocupa_horario and p_comportamento<>'ATIVO')
 or p_origens is null or cardinality(p_origens)=0
 or not (p_origens <@ array['AGENDADO','EM ATENDIMENTO','REAGENDADO']::text[])
 or array_position(p_origens,null) is not null or p_ativo is null then
  raise exception 'Configuração de status inválida';
 end if;
 if p_id is null then
  insert into public.status_personalizados(nome,cor,comportamento,ocupa_horario,origens,ativo,criado_por)
  values(btrim(p_nome),p_cor,p_comportamento,p_ocupa_horario,p_origens,p_ativo,auth.uid()) returning id into v_id;
 else
  select * into v_old from public.status_personalizados where id=p_id for update;
  if not found then raise exception 'Status não encontrado'; end if;
  -- Com agendamentos em andamento, não alterar sua semântica operacional.
  if exists(select 1 from public.agendamentos where status=v_old.nome)
    and (v_old.nome is distinct from btrim(p_nome) or v_old.comportamento is distinct from p_comportamento
         or v_old.ocupa_horario is distinct from p_ocupa_horario) then
    raise exception 'Status em uso: nome, comportamento e ocupação não podem ser alterados';
  end if;
  -- Não renomear status com histórico agregado nem após eliminação dos agendamentos.
  if v_old.nome is distinct from btrim(p_nome) and exists(select 1 from public.estatisticas_diarias where status=v_old.nome) then
    raise exception 'Status presente no histórico: renomeação bloqueada';
  end if;
  update public.status_personalizados set nome=btrim(p_nome),cor=p_cor,comportamento=p_comportamento,
  ocupa_horario=p_ocupa_horario,origens=p_origens,ativo=p_ativo,atualizado_em=now()
  where id=p_id returning id into v_id;
 end if;
 insert into public.auditoria(usuario_id,tipo_acao,recurso_tipo,recurso_id)
 values(auth.uid(),case when p_id is null then 'STATUS_CRIADO' else 'STATUS_ATUALIZADO' end,'STATUS_PERSONALIZADO',v_id);
 return v_id;
end $$;

-- Status personalizados são aplicados somente por quem já pode registrar resultados.
-- Um destino final sempre é removido em sete dias; nunca é permitido sair de um terminal.
create or replace function public.atualizar_resultado_agendamento(p_id uuid,p_versao integer,p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.agendamentos%rowtype; v_ok boolean := false; v_tipo text; v_destino record;
begin
 select * into a from public.agendamentos where id=p_id for update;
 if not found or not public.ieva_pode_alterar(a.empresa_id,a.criado_por_usuario_id,'RESULTADO') then raise exception 'Acesso negado'; end if;
 if a.versao is distinct from p_versao then raise exception 'Conflito de versão'; end if;
 if a.status in ('DESBLOQUEADO','CANCELADO','CLIENTE NÃO ATENDEU')
    or exists(select 1 from public.status_personalizados s where s.nome=a.status and s.comportamento<>'ATIVO') then
    raise exception 'Status terminal não permite alteração';
 end if;
 v_ok:=(a.status in ('AGENDADO','REAGENDADO') and p_status='EM ATENDIMENTO')
    or (a.status='EM ATENDIMENTO' and p_status in ('DESBLOQUEADO','CLIENTE NÃO ATENDEU'))
    or (exists(select 1 from public.status_personalizados s where s.nome=a.status and s.comportamento='ATIVO')
        and p_status in ('EM ATENDIMENTO','DESBLOQUEADO','CLIENTE NÃO ATENDEU'));
 if not v_ok then
  select s.comportamento into v_tipo from public.status_personalizados s
  where s.nome=p_status and s.ativo and a.status=any(s.origens);
  v_ok:=found;
 end if;
 if not v_ok or p_status=a.status then raise exception 'Transição não permitida'; end if;
 -- Sincroniza concorrência da ocupação quando há alteração do estado do slot.
 perform public.ieva_slot_lock(a.data_atendimento,a.hora_atendimento);
 perform public.ieva_movimentar_estatistica(a.data_atendimento,a.empresa_id,a.responsavel_usuario_id,a.hora_atendimento,a.status,-1);
 update public.agendamentos set status=p_status,versao=versao+1,atualizado_em=now(),
 encerrado_em=case when p_status in ('DESBLOQUEADO','CLIENTE NÃO ATENDEU') or v_tipo in ('CONCLUIDO','ENCERRADO') then now() else null end,
 excluir_apos=case when p_status in ('DESBLOQUEADO','CLIENTE NÃO ATENDEU') or v_tipo in ('CONCLUIDO','ENCERRADO') then now()+interval '7 days' else null end
 where id=p_id;
 perform public.ieva_movimentar_estatistica(a.data_atendimento,a.empresa_id,a.responsavel_usuario_id,a.hora_atendimento,p_status,1);
 insert into public.historico_agendamentos(agendamento_id,usuario_id,tipo_evento,dados_anteriores,dados_novos)
 values(p_id,auth.uid(),'STATUS',jsonb_build_object('status',a.status),jsonb_build_object('status',p_status));
 perform public.ieva_notificar(p_id,a.empresa_id,'STATUS');
 insert into public.auditoria(usuario_id,empresa_id,tipo_acao,recurso_tipo,recurso_id)
 values(auth.uid(),a.empresa_id,'STATUS','AGENDAMENTO',p_id);
 return jsonb_build_object('situacao','OK','id',p_id,'versao',a.versao+1);
end $$;

-- Reagendamento e cancelamento passam a aceitar também estados personalizados ATIVO.
-- Ajustes cirúrgicos sobre as funções da migração 002, mantendo as validações de perfil.
-- O código completo das funções é redefinido abaixo por segurança e reprodutibilidade.

create or replace function public.reagendar_agendamento(p_id uuid,p_versao integer,p_data date,p_hora time,
 p_confirmar_lotacao boolean default false,p_contagem_confirmada integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.agendamentos%rowtype; v_qtd integer;
begin
 -- Lock no registro antes do slot para serializar alterações no mesmo registro.
 select * into a from public.agendamentos where id=p_id for update;
 if not found or not public.ieva_pode_alterar(a.empresa_id,a.criado_por_usuario_id,'REAGENDAR') then raise exception 'Acesso negado'; end if;
 if a.versao is distinct from p_versao then raise exception 'Conflito: registro atualizado por outra pessoa'; end if;
 if a.status not in ('AGENDADO','EM ATENDIMENTO','CLIENTE NÃO ATENDEU','REAGENDADO') and not exists (select 1 from public.status_personalizados s where s.nome=a.status and s.comportamento='ATIVO') then raise exception 'Transição não permitida'; end if;
 if p_data is null or p_hora is null or extract(minute from p_hora)::int%15<>0 or extract(second from p_hora)<>0 or
 (p_data+p_hora) <= (now() at time zone 'America/Sao_Paulo') then raise exception 'Data/hora inválida ou passada'; end if;
 perform public.ieva_slot_lock(p_data,p_hora);
 v_qtd:=public.ieva_contagem(p_data,p_hora);
 if public.ieva_status_ocupa(a.status) and a.data_atendimento=p_data and a.hora_atendimento=p_hora then v_qtd:=v_qtd-1; end if;
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

create or replace function public.cancelar_agendamento(p_id uuid,p_versao integer,p_justificativa text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.agendamentos%rowtype;
begin
 select * into a from public.agendamentos where id=p_id for update;
 if not found or not public.ieva_pode_alterar(a.empresa_id,a.criado_por_usuario_id,'CANCELAR') then raise exception 'Acesso negado'; end if;
 if a.versao is distinct from p_versao then raise exception 'Conflito de versão'; end if;
 if a.status not in ('AGENDADO','EM ATENDIMENTO','CLIENTE NÃO ATENDEU','REAGENDADO') and not exists (select 1 from public.status_personalizados s where s.nome=a.status and s.comportamento='ATIVO') then raise exception 'Transição não permitida'; end if;
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

create or replace function public.ieva_limpeza_retencao(p_lote integer default 500)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ag integer; v_audit integer;
begin
 if session_user not in ('postgres','service_role') then raise exception 'Execução administrativa apenas'; end if;
 if p_lote<1 or p_lote>5000 then raise exception 'Lote fora de faixa'; end if;
 with alvos as (select id from public.agendamentos
    where excluir_apos<=now() and (status in ('DESBLOQUEADO','CANCELADO','CLIENTE NÃO ATENDEU') or exists (select 1 from public.status_personalizados s where s.nome=agendamentos.status and s.comportamento in ('CONCLUIDO','ENCERRADO')))
    order by excluir_apos limit p_lote for update skip locked),
 apagados as (delete from public.agendamentos where id in (select id from alvos) returning id)
 select count(*) into v_ag from apagados;
 with alvos as (select id from public.auditoria where criado_em<now()-interval '7 days' order by criado_em limit p_lote),
 apagados as (delete from public.auditoria where id in (select id from alvos) returning id)
 select count(*) into v_audit from apagados;
 return jsonb_build_object('agendamentos_excluidos',v_ag,'auditorias_excluidas',v_audit);
end; $$;

-- Compatibilidade: a função criar_agendamento existente já permite CPF repetido,
-- exigindo apenas confirmação informativa. Não há índice UNIQUE de CPF.
-- Reforço preventivo: nenhuma chave única cliente_cpf/data deve ser adicionada.
-- Helpers ficam inacessíveis via RPC anônima.
revoke all on function public.ieva_status_ocupa(text),public.ieva_salvar_status(uuid,text,text,text,boolean,text[],boolean),
 public.ieva_validar_status_agendamento() from public,anon,authenticated;
grant execute on function public.ieva_salvar_status(uuid,text,text,text,boolean,text[],boolean) to authenticated;
commit;
