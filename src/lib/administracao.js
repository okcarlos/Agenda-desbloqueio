import { supabase } from './supabase.js'

async function rpc(name, params = {}) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message)
  return data
}
export const carregarDashboard = filters => rpc('ieva_dashboard', {
  p_inicio: filters.inicio || null, p_fim: filters.fim || null,
  p_empresa: filters.empresa || null, p_responsavel: filters.responsavel || null,
  p_status: filters.status || null, p_hora: filters.hora || null,
})
export const listarEmpresasAdmin = () => rpc('ieva_listar_empresas_admin')
export const salvarEmpresa = value => rpc('ieva_salvar_empresa', {
  p_id: value.id || null, p_nome: value.nome, p_responsavel: value.responsavel_nome || null,
  p_telefone: value.telefone || null, p_email: value.email || null, p_ativa: value.ativa,
})
export const listarUsuariosAdmin = () => rpc('ieva_listar_usuarios_admin')
export const atualizarUsuarioAdmin = value => rpc('ieva_atualizar_usuario_admin', { p_id: value.id, p_nome: value.nome, p_ativo: value.ativo })
export async function criarUsuarioAdmin(value) {
  const { data, error } = await supabase.functions.invoke('criar-usuario', { body: value })
  if (error) throw new Error(error.message || 'Falha ao chamar função protegida')
  if (data?.error) throw new Error(data.error)
  return data
}
export async function listarNotificacoes() {
  const { data, error } = await supabase.from('notificacoes')
    .select('id,tipo_evento,titulo,mensagem,agendamento_id,criado_em,lida_em')
    .order('criado_em', { ascending: false }).limit(100)
  if (error) throw new Error(error.message)
  return data || []
}
export const marcarLida = id => rpc('marcar_notificacao_lida', { p_id: id })
