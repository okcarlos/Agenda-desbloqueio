import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const raiz = new URL('../', import.meta.url)
const ler = arquivo => readFileSync(new URL(arquivo, raiz), 'utf8')

test('operações operacionais são feitas via RPC; não há service role no frontend', () => {
  const front = ['src/lib/agendamentos.js','src/lib/status.js','src/lib/supabase.js'].map(ler).join('\n')
  for (const rpc of ['criar_agendamento','reagendar_agendamento','cancelar_agendamento','atualizar_resultado_agendamento']) {
    assert.ok(front.includes(`'${rpc}'`), `RPC ausente: ${rpc}`)
  }
  assert.doesNotMatch(ler('src/lib/supabase.js'), /VITE_SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_SECRET_KEY/)
})

test('migrations da etapa 1 até a 6 permanecem presentes', () => {
  const migrations = readdirSync(new URL('supabase/migrations/', raiz))
  for (let n = 1; n <= 6; n++) assert.ok(migrations.some(f => f.match(new RegExp(`00${n}_`))), `migração ${n} ausente`)
})

test('perfis, status e restrições na rota continuam preservados', () => {
  const app = ler('src/App.jsx')
  for (const perfil of ['ADMIN_GERAL','ADMIN_EMPRESA','PARCEIRO','DESBLOQUEIO']) assert.ok(app.includes(perfil))
  assert.ok(app.includes('<AllowRoles allowed={[\'ADMIN_GERAL\']}><GerenciarStatus'))
  assert.ok(app.includes('<AllowRoles allowed={[\'ADMIN_GERAL\']}><BackupSistema'))
})
