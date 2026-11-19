import { supabase } from './supabase.js'
export { PADRAO, corInline } from './statusCores.js'
export async function carregarStatusPersonalizados() {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.from('status_personalizados').select('id,nome,cor,comportamento,ocupa_horario,origens,ativo').order('nome')
  if (error) throw new Error(error.message)
  return data || []
}
export async function salvarStatusPersonalizado(s) {
  const { data, error } = await supabase.rpc('ieva_salvar_status', {
    p_id: s.id || null, p_nome: s.nome.trim(), p_cor: s.cor,
    p_comportamento: s.comportamento, p_ocupa_horario: Boolean(s.ocupa_horario),
    p_origens: s.origens, p_ativo: Boolean(s.ativo)
  })
  if (error) throw new Error(error.message)
  return data
}
