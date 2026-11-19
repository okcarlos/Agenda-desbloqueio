import http from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { randomBytes, scryptSync, createCipheriv } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, rm, stat, appendFile, chmod, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { pipeline } from 'node:stream/promises'

const must = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','PGHOST','PGUSER','PGPASSWORD','PGDATABASE','ALLOWED_ORIGIN']
for(const k of must) if(!process.env[k]) throw new Error(`Falta configuração ${k}`)
const service = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}})
const origin = process.env.ALLOWED_ORIGIN
const port = Number(process.env.PORT||8787)
let running = false
function send(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))}
async function body(req){
 const chunks=[];let size=0
 for await (const c of req){size+=c.length;if(size>4096)throw new Error('Requisição muito grande');chunks.push(c)}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
async function admin(req){
 const token=(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1]
 if(!token) return null
 const {data:{user},error}=await service.auth.getUser(token)
 if(error||!user) return null
 const {data:profile,error:pe}=await service.from('usuarios').select('id,perfil,ativo,troca_senha_pendente,empresa_id').eq('id',user.id).single()
 if(pe||!profile||!profile.ativo||profile.troca_senha_pendente||profile.perfil!=='ADMIN_GERAL')return null
 return user
}
function execute(command,args,env,stdoutPath){
 return new Promise((resolve,reject)=>{
  const cp=spawn(command,args,{env,stdio:['ignore',stdoutPath?'pipe':'ignore','pipe']})
  let err=''
  cp.stderr.on('data',c=>{if(err.length<2000)err+=String(c).slice(0,500)})
  if(stdoutPath){
   const out=createWriteStream(stdoutPath,{mode:0o600,flags:'wx'})
   cp.stdout.pipe(out)
   out.on('error',e=>{cp.kill();reject(e)})
  }
  cp.on('error',reject)
  cp.on('close',code=>code===0?resolve():reject(new Error(`Comando ${command} falhou (código ${code}). ${err.replace(/password[^\n]*/gi,'[oculto]').slice(0,180)}`)))
 })
}
async function registrar(userId,status,ref=null,id=null){
 if(!id){
  const r=await service.from('operacoes_administrativas').insert({tipo_operacao:'BACKUP_MANUAL',solicitante_id:userId,situacao:'SOLICITADA'}).select('id').single()
  if(r.error)throw new Error('Não foi possível registrar a solicitação de backup')
  return r.data.id
 }
 const r=await service.from('operacoes_administrativas').update({situacao:status,resultado_referencia:ref,concluido_em:new Date().toISOString()}).eq('id',id)
 if(r.error)throw new Error('Não foi possível registrar o resultado do backup')
 return id
}
async function gerar(req,res,user){
 if(running)return send(res,409,{erro:'Há um backup em execução. Tente novamente mais tarde.'})
 running=true;let dir=null,operation=null
 try{
  const payload=await body(req)
  const passphrase=payload?.senha
  if(typeof passphrase!=='string'||passphrase.length<16||passphrase.length>512) return send(res,400,{erro:'Use uma senha de criptografia de 16 a 512 caracteres.'})
  operation=await registrar(user.id,'SOLICITADA')
  dir=await mkdtemp(join(tmpdir(),'ieva-backup-'))
  await chmod(dir,0o700)
  const raw=join(dir,'dados.dump'),encrypted=join(dir,'dados.ieva')
  const env={...process.env,PGPASSWORD:process.env.PGPASSWORD}
  // Back-up consistente do schema public (dados, RLS, tabelas, funções). Não inclui Auth nem Storage.
  await execute('pg_dump',['--format=custom','--no-owner','--schema=public','--file='+raw],env)
  const metadata=await stat(raw)
  if(metadata.size<256)throw new Error('Dump vazio ou incompleto')
  await execute('pg_restore',['--list',raw],env)
  const salt=randomBytes(16),iv=randomBytes(12)
  const key=scryptSync(passphrase,salt,32,{N:16384,r:8,p:1})
  const cipher=createCipheriv('aes-256-gcm',key,iv)
  // Formato: magic IEV6 + salt16 + iv12 + ciphertext + tag16
  await writeFile(encrypted,Buffer.concat([Buffer.from('IEV6'),salt,iv]),{mode:0o600})
  await pipeline(createReadStream(raw),cipher,createWriteStream(encrypted,{flags:'a',mode:0o600}))
  await appendFile(encrypted,cipher.getAuthTag())
  const e=await stat(encrypted)
  await registrar(user.id,'EXECUTADA',`Dump public criptografado AES-256-GCM; ${e.size} bytes`,operation)
  const filename=`IEV_Avanca_backup_${new Date().toISOString().slice(0,10)}.ieva`
  res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${filename}"`,'Content-Length':String(e.size),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
  await pipeline(createReadStream(encrypted),res)
 }catch(e){
  if(operation)try{await registrar(user.id,'FALHOU','Falha no procedimento protegido',operation)}catch{}
  if(!res.headersSent)send(res,500,{erro:'Não foi possível gerar o backup íntegro. Verifique o servidor e suas permissões.'})
  console.error('Falha na operação de backup:',String(e.message).replace(/password[^\n]*/gi,'[oculto]'))
 }finally{
  if(dir)await rm(dir,{recursive:true,force:true}).catch(()=>{})
  running=false
 }
}
const server=http.createServer(async(req,res)=>{
 if(req.headers.origin && req.headers.origin!==origin)return send(res,403,{erro:'Origem não permitida'})
 res.setHeader('Access-Control-Allow-Origin',origin)
 res.setHeader('Vary','Origin')
 res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type')
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS')
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
 if(!req.url?.startsWith('/api/backup'))return send(res,404,{erro:'Não encontrado'})
 try{
  const user=await admin(req)
  if(!user)return send(res,403,{erro:'Administrador geral autenticado necessário'})
  if(req.method==='GET'&&req.url==='/api/backup'){
   const r=await service.from('operacoes_administrativas').select('id,criado_em,concluido_em,situacao,resultado_referencia').eq('tipo_operacao','BACKUP_MANUAL').order('criado_em',{ascending:false}).limit(5)
   if(r.error)throw r.error
   return send(res,200,{historico:r.data||[]})
  }
  if(req.method==='POST'&&req.url==='/api/backup')return await gerar(req,res,user)
  return send(res,405,{erro:'Método não permitido'})
 }catch(e){console.error('Falha de autorização/consulta:',e.message);if(!res.headersSent)send(res,500,{erro:'Erro no serviço de backup'})}
})
server.requestTimeout=600000
server.listen(port,()=>console.log(`Serviço de backup disponível na porta ${port}; configure HTTPS no proxy.`))
