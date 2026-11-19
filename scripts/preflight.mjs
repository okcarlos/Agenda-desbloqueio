#!/usr/bin/env node
// Etapa 8: validação local sem revelar ou enviar segredos.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

export function validarConfiguracao({ root = process.cwd(), env = process.env, producao = false } = {}) {
  const problemas = []
  const avisos = []
  const arquivo = caminho => existsSync(resolve(root, caminho))
  const url = env.VITE_SUPABASE_URL || ''
  const chave = env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
  const backup = env.VITE_IEVA_BACKUP_API_URL || ''
  const migrations = arquivo('supabase/migrations') ? readdirSync(resolve(root, 'supabase/migrations')) : []

  for (let n = 1; n <= 6; n++) {
    if (!migrations.some(m => m.includes(`00${n}_`) && m.endsWith('.sql'))) problemas.push(`Migração 00${n} ausente`)
  }
  for (const f of ['src/lib/statusCores.js','src/pages/GerenciarStatus.jsx','src/components/CalendarioMensal.jsx','backup-worker/server.js','supabase/manual/ativar_cron_retencao.sql']) {
    if (!arquivo(f)) problemas.push(`Arquivo obrigatório ausente: ${f}`)
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) problemas.push('VITE_SUPABASE_URL deve apontar para URL HTTPS válida do seu projeto Supabase')
  if (!chave || chave.includes('COLE_') || chave.startsWith('sb_secret_') || chave.startsWith('sb_secret') || chave.startsWith('sb_service_')) problemas.push('Use somente chave pública/publicável no frontend')
  if (env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SECRET_KEY) problemas.push('Segredo privilegiado com prefixo VITE_ é proibido')
  if (backup) {
    try {
      const b = new URL(backup)
      if (b.protocol !== 'https:' && !(b.protocol === 'http:' && ['localhost','127.0.0.1'].includes(b.hostname))) problemas.push('Serviço de backup precisa de HTTPS fora de localhost')
      if (b.username || b.password) problemas.push('URL do serviço de backup não pode incluir credenciais')
    } catch { problemas.push('URL do serviço de backup inválida') }
  } else avisos.push('Serviço de backup não configurado: backup manual indisponível')
  if (producao && !backup) problemas.push('Produção requer serviço de backup configurado e testado')
  if (!arquivo('dist/index.html')) avisos.push('Build dist ausente: execute npm run build')
  if (arquivo('.env')) {
    const texto = readFileSync(resolve(root, '.env'), 'utf8')
    if (/^\s*VITE_.*(?:SERVICE_ROLE|SECRET_KEY|PGPASSWORD|PRIVATE_KEY)/mi.test(texto)) problemas.push('Arquivo .env contém possível segredo exposto ao Vite')
  }
  avisos.push('Esta checagem NÃO confirma RLS, Cron, teste de carga, LGPD, restauração nem o serviço remoto')
  return { problemas, avisos }
}

function lerEnvLocal(root) {
  const p = resolve(root, '.env')
  if (!existsSync(p)) return {}
  const result = {}
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) result[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const producao = process.argv.includes('--production')
  const env = { ...lerEnvLocal(process.cwd()), ...process.env }
  const { problemas, avisos } = validarConfiguracao({ env, producao })
  console.log(`Pré-publicação IEV Avança (${producao ? 'produção' : 'desenvolvimento'})`)
  for (const a of avisos) console.log(`AVISO: ${a}`)
  for (const p of problemas) console.error(`ERRO: ${p}`)
  console.log(problemas.length ? `NÃO APROVADO: ${problemas.length} problema(s).` : 'Checagens locais passaram; ainda exige homologação real.')
  process.exitCode = problemas.length ? 1 : 0
}
