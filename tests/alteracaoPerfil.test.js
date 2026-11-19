import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('mudança de perfil exige administrador geral e rejeita alteração do próprio perfil', () => {
  const sql = read('supabase/migrations/202611190007_alteracao_perfil_usuario.sql')
  assert.match(sql, /c\.perfil = 'ADMIN_GERAL'/)
  assert.match(sql, /p_id = auth\.uid\(\)/)
  assert.match(sql, /v_mudou_privilegios/)
  assert.match(sql, /p_justificativa/)
  assert.match(sql, /public\.auditoria/)
  assert.match(sql, /GRANT EXECUTE[\s\S]+TO authenticated;/)
  assert.match(sql, /REVOKE ALL[\s\S]+FROM PUBLIC, anon, authenticated;/)
})

test('interface só oferece mudança de perfil ao Administrador geral', () => {
  const page = read('src/pages/AdminEtapa4.jsx')
  const client = read('src/lib/administracao.js')
  assert.match(page, /general&&<label>Perfil/)
  assert.match(page, /general\) await alterarUsuarioGeral/)
  assert.match(page, /editingOriginal/)
  assert.match(client, /ieva_alterar_usuario_geral/)
})
