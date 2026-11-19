import { useEffect, useState } from 'react'
import { Download, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
const base = (import.meta.env.VITE_IEVA_BACKUP_API_URL || '').replace(/\/$/,'')
async function requisitar(path,params={}) {
  if(!base) throw new Error('Configure VITE_IEVA_BACKUP_API_URL para apontar ao serviço seguro de backup.')
  const {data:{session}}=await supabase.auth.getSession()
  if(!session?.access_token)throw new Error('Sessão expirada. Entre novamente.')
  const res=await fetch(`${base}${path}`,{...params,headers:{Authorization:`Bearer ${session.access_token}`,...params.headers}})
  if(!res.ok){const erro=await res.json().catch(()=>({}));throw new Error(erro.erro||'Serviço de backup indisponível')}
  return res
}
export default function BackupSistema(){
 const [senha,setSenha]=useState('')
 const [confirma,setConfirma]=useState(false)
 const [busy,setBusy]=useState(false)
 const [erro,setErro]=useState('')
 const [historico,setHistorico]=useState([])
 const [aviso,setAviso]=useState('')
 const carregar=async()=>{try{const r=await requisitar('/api/backup');const j=await r.json();setHistorico(j.historico||[])}catch(e){setErro(e.message)}}
 useEffect(()=>{void carregar()},[])
 const gerar=async()=>{
  setErro('');setAviso('');setBusy(true)
  try{
   const r=await requisitar('/api/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({senha})})
   const blob=await r.blob()
   if(!blob.size)throw new Error('O servidor retornou um arquivo vazio.')
   const url=URL.createObjectURL(blob)
   const a=document.createElement('a');a.href=url;a.download=`IEV_Avanca_backup_${new Date().toISOString().slice(0,10)}.ieva`;a.click()
   setTimeout(()=>URL.revokeObjectURL(url),60000)
   setAviso('Arquivo criptografado recebido. Guarde-o com segurança e mantenha a senha em local separado. Ele NÃO contém identidades do Supabase Auth.')
   setSenha('');setConfirma(false);await carregar()
  }catch(e){setErro(e.message)}finally{setBusy(false)}
 }
 return <div className="page-stack"><div className="page-intro"><div><span className="eyebrow">ADMINISTRAÇÃO</span><h2>Backup do Sistema</h2><p>Backup manual criptografado da estrutura e dos dados de aplicação (schema public).</p></div></div>
 <section className="panel" style={{padding:24}}><h3><ShieldCheck size={20}/> Gerar backup manual</h3>
 <p>Exclusivo do Administrador geral. A geração acontece em servidor protegido com PostgreSQL pg_dump; não é exportação de agendamentos. Requer serviço externo configurado, HTTPS e senha de criptografia forte.</p>
 <p className="notice-strip">Limite importante: este backup NÃO inclui contas/credenciais do Supabase Auth, arquivos do Storage ou infraestrutura externa. Restauração integral exige procedimento complementar testado.</p>
 <label>Senha para criptografar (mínimo 16 caracteres)<input type="password" autoComplete="new-password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Guarde esta senha fora do sistema"/></label>
 <label style={{display:'flex',gap:8,alignItems:'center',marginTop:14}}><input type="checkbox" checked={confirma} onChange={e=>setConfirma(e.target.checked)}/> Confirmo que armazenarei o arquivo e a senha separadamente e seguirei a política de retenção.</label>
 {erro&&<p role="alert" className="inline-error">{erro}</p>}{aviso&&<p role="status" className="notice-strip">{aviso}</p>}
 <button className="btn primary" disabled={busy||senha.length<16||!confirma||!base} onClick={()=>void gerar()}><Download size={18}/>{busy?'Gerando arquivo protegido…':'Gerar backup manual'}</button>
 {!base&&<p className="inline-error">Serviço de backup ainda não configurado. Consulte docs/ETAPA_6_CALENDARIO_RETENCAO_BACKUP.md.</p>}
 </section><section className="panel" style={{padding:24}}><h3>Últimas execuções</h3>{historico.length===0?<p>Nenhuma execução acessível ou serviço ainda não configurado.</p>:<div className="table-wrap"><table className="central-table"><thead><tr><th>Solicitado</th><th>Situação</th><th>Resultado</th></tr></thead><tbody>{historico.map(h=><tr key={h.id}><td>{new Date(h.criado_em).toLocaleString('pt-BR')}</td><td>{h.situacao}</td><td>{h.resultado_referencia||'—'}</td></tr>)}</tbody></table></div>}</section></div>
}
