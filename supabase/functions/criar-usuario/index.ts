// Supabase Edge Function — código de servidor isolado; frontend permanece 100% JS/JSX.
// Deploy com verify_jwt habilitado. SUPABASE_SERVICE_ROLE_KEY somente nos segredos do servidor.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
const roles = ['ADMIN_GERAL', 'ADMIN_EMPRESA', 'PARCEIRO', 'DESBLOQUEIO']
const toHex = (bytes: Uint8Array) => Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('')

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return response({ error: 'Método não permitido' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !serviceKey || !publicKey) return response({ error: 'Servidor não configurado' }, 500)
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return response({ error: 'Autenticação necessária' }, 401)

  const authClient = createClient(url, publicKey, { auth: { persistSession: false } })
  const { data: callerAuth, error: authError } = await authClient.auth.getUser(token)
  if (authError || !callerAuth.user) return response({ error: 'Sessão inválida' }, 401)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: current, error: currentError } = await admin.from('usuarios')
    .select('id,perfil,empresa_id,ativo,troca_senha_pendente,empresas(ativa)')
    .eq('id', callerAuth.user.id).single()
  if (currentError || !current?.ativo || current.troca_senha_pendente || !['ADMIN_GERAL','ADMIN_EMPRESA'].includes(current.perfil)) return response({ error: 'Acesso negado' }, 403)
  if (current.perfil === 'ADMIN_EMPRESA' && !current.empresas?.ativa) return response({ error: 'Empresa inativa' }, 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return response({ error: 'Dados inválidos' }, 400) }
  const nome = String(body.nome || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const perfil = current.perfil === 'ADMIN_EMPRESA' ? 'PARCEIRO' : String(body.perfil || '')
  const empresaId = ['PARCEIRO','ADMIN_EMPRESA'].includes(perfil) ? (current.perfil === 'ADMIN_EMPRESA' ? current.empresa_id : body.empresa_id) : null
  if (nome.length < 2 || nome.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !roles.includes(perfil)) return response({ error: 'Nome, email ou perfil inválidos' }, 400)
  if (current.perfil === 'ADMIN_EMPRESA' && (body.perfil && body.perfil !== 'PARCEIRO' || body.empresa_id && body.empresa_id !== current.empresa_id)) return response({ error: 'Somente Parceiros da própria empresa são permitidos' }, 403)
  if (['PARCEIRO','ADMIN_EMPRESA'].includes(perfil)) {
    if (typeof empresaId !== 'string') return response({ error: 'Empresa obrigatória' }, 400)
    const { data: company } = await admin.from('empresas').select('id,ativa').eq('id', empresaId).single()
    if (!company?.ativa) return response({ error: 'Empresa inexistente ou inativa' }, 400)
  }
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const temporaryPassword = `IEV-${toHex(bytes)}`
  const { data: created, error: creationError } = await admin.auth.admin.createUser({
    email, password: temporaryPassword, email_confirm: true,
    user_metadata: { nome },
  })
  if (creationError || !created.user) return response({ error: creationError?.message || 'Não foi possível criar usuário' }, 400)
  const { error: profileError } = await admin.from('usuarios').insert({
    id: created.user.id, nome, email, perfil, empresa_id: empresaId,
    ativo: true, troca_senha_pendente: true, criado_por: callerAuth.user.id,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return response({ error: 'Não foi possível registrar perfil; criação revertida' }, 500)
  }
  await admin.from('auditoria').insert({
    usuario_id: callerAuth.user.id, empresa_id: empresaId,
    tipo_acao: 'USUARIO_CRIADO', recurso_tipo: 'USUARIO', recurso_id: created.user.id,
  })
  // Nunca gravar a senha provisória em banco/log. Retornada uma única vez ao administrador autenticado.
  return response({ id: created.user.id, email, temporary_password: temporaryPassword }, 201)
})
