import test from 'node:test'
import assert from 'node:assert/strict'
import { validarConfiguracao } from '../scripts/preflight.mjs'
const root = new URL('../', import.meta.url).pathname
const base = {
  root,
  env: {
    VITE_SUPABASE_URL: 'https://projeto-test.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_teste',
    VITE_IEVA_BACKUP_API_URL: 'https://backup.exemplo.org'
  }
}
test('configuração pública válida permite seguir para homologação, não equivale à aprovação para produção', () => {
  const r = validarConfiguracao(base)
  assert.deepEqual(r.problemas, [])
  assert.ok(r.avisos.some(s => s.includes('NÃO confirma RLS')))
})
test('não permite chaves secretas em variáveis públicas', () => {
  const r = validarConfiguracao({...base, env: {...base.env, VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_inadequada'}})
  assert.ok(r.problemas.some(s => s.includes('chave pública')))
})
test('não aceita serviço HTTP remoto em produção', () => {
  const r = validarConfiguracao({...base, producao:true, env:{...base.env,VITE_IEVA_BACKUP_API_URL:'http://backup.exemplo.org'}})
  assert.ok(r.problemas.some(s => s.includes('HTTPS')))
})
test('backup não configurado bloqueia preflight de produção', () => {
  const r = validarConfiguracao({...base, producao:true, env:{...base.env,VITE_IEVA_BACKUP_API_URL:''}})
  assert.ok(r.problemas.some(s => s.includes('backup configurado')))
})
test('URL de serviço com credenciais é rejeitada', () => {
  const r = validarConfiguracao({...base, env:{...base.env,VITE_IEVA_BACKUP_API_URL:'https://user:pass@backup.exemplo.org'}})
  assert.ok(r.problemas.some(s => s.includes('credenciais')))
})
