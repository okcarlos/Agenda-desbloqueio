import { supabase } from './supabase.js'

export async function resumoCalendario({inicio,fim,empresaId,responsavelId,status}) {
  if (!supabase) throw new Error('Supabase não configurado')
  const {data,error} = await supabase.rpc('ieva_resumo_calendario', {
    p_inicio:inicio, p_fim:fim, p_empresa:empresaId||null,
    p_responsavel:responsavelId||null, p_status:status||null
  })
  if (error) throw new Error(error.message)
  return data||[]
}
