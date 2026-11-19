// Etapa 2: cliente das RPCs SQL autorizadas. Não realiza escrita direta em tabelas.
import { supabase } from './supabase.js'

function cliente() {
  if (!supabase) throw new Error('Configure as variáveis VITE_SUPABASE_* antes de continuar.')
  return supabase
}
async function executar(nome, parametros) {
  const { data, error } = await cliente().rpc(nome, parametros)
  if (error) throw new Error(error.message)
  return data
}

// O caller deve conservar operacaoId entre tentativas de um mesmo salvamento.
// Se o servidor pedir confirmação, reenviar mesma operacaoId com os avisos aceitos.
export function criarAgendamento(dados, avisos = {}) {
  return executar('criar_agendamento', {
    p_operacao_id: dados.operacaoId,
    p_empresa_id: dados.empresaId,
    p_nome: dados.nome,
    p_cpf: dados.cpf,
    p_telefone: dados.telefone,
    p_proposta: dados.proposta,
    p_data: dados.data, // YYYY-MM-DD, fuso operacional America/Sao_Paulo
    p_hora: dados.hora, // HH:mm, minutos 00/15/30/45
    p_observacoes: dados.observacoes || null,
    p_confirmar_lotacao: Boolean(avisos.confirmarLotacao),
    p_contagem_confirmada: avisos.contagemConfirmada ?? null,
    p_confirmar_duplicidade: Boolean(avisos.confirmarDuplicidade),
  })
}
export function reagendarAgendamento(id, versao, data, hora, avisos = {}) {
  return executar('reagendar_agendamento', {
    p_id: id, p_versao: versao, p_data: data, p_hora: hora,
    p_confirmar_lotacao: Boolean(avisos.confirmarLotacao),
    p_contagem_confirmada: avisos.contagemConfirmada ?? null,
  })
}
export function cancelarAgendamento(id, versao, justificativa) {
  return executar('cancelar_agendamento', { p_id: id, p_versao: versao, p_justificativa: justificativa })
}
export function atualizarResultadoAgendamento(id, versao, status) {
  return executar('atualizar_resultado_agendamento', { p_id: id, p_versao: versao, p_status: status })
}
export function registrarTratativaAgendamento(id, observacao) {
  return executar('registrar_tratativa_agendamento', { p_id: id, p_observacao: observacao })
}
export function marcarNotificacaoLida(id) {
  return executar('marcar_notificacao_lida', { p_id: id })
}

// A RLS restringe automaticamente os agendamentos ao escopo do perfil.
export async function listarAgendamentos({ pagina = 1, empresaId, responsavelId, status, inicio, fim, hora, busca } = {}) {
  const page = Math.max(1, Number(pagina) || 1)
  let query = cliente().from('agendamentos')
    .select('id,empresa_id,responsavel_usuario_id,cliente_nome,cliente_cpf,cliente_telefone,numero_proposta,data_atendimento,hora_atendimento,status,versao', { count: 'exact' })
    .order('data_atendimento', { ascending: true })
    .order('hora_atendimento', { ascending: true })
    .range((page - 1) * 25, page * 25 - 1)
  if (empresaId) query = query.eq('empresa_id', empresaId)
  if (status) query = query.eq('status', status)
  if (responsavelId) query = query.eq('responsavel_usuario_id', responsavelId)
  if (hora) query = query.eq('hora_atendimento', hora + ':00')
  if (busca?.trim()) {
    const termo = busca.trim().replace(/[,%()]/g, '')
    if (termo) query = query.or(`cliente_nome.ilike.%${termo}%,cliente_cpf.ilike.%${termo}%,numero_proposta.ilike.%${termo}%`)
  }
  if (inicio) query = query.gte('data_atendimento', inicio)
  if (fim) query = query.lte('data_atendimento', fim)
  const { data, count, error } = await query
  if (error) throw new Error(error.message)
  return { registros: data || [], total: count || 0, pagina: page }
}

export async function obterOpcoesAgendamentos(empresaId = null) {
  const [empresas, usuarios] = await Promise.all([
    cliente().rpc('ieva_empresas_visiveis'),
    cliente().rpc('ieva_usuarios_visiveis', { p_empresa: empresaId }),
  ])
  if (empresas.error) throw new Error(empresas.error.message)
  if (usuarios.error) throw new Error(usuarios.error.message)
  return { empresas: empresas.data || [], usuarios: usuarios.data || [] }
}

export async function obterDetalhesAgendamento(id) {
  const [agendamento, historico, tratativas] = await Promise.all([
    cliente().from('agendamentos').select('*').eq('id', id).single(),
    cliente().from('historico_agendamentos').select('tipo_evento,dados_anteriores,dados_novos,justificativa,usuario_id,criado_em').eq('agendamento_id', id).order('criado_em', { ascending: true }),
    cliente().from('tratativas').select('id,usuario_id,observacao,criado_em').eq('agendamento_id', id).order('criado_em', { ascending: true }),
  ])
  for (const result of [agendamento, historico, tratativas]) if (result.error) throw new Error(result.error.message)
  return { agendamento: agendamento.data, historico: historico.data || [], tratativas: tratativas.data || [] }
}
