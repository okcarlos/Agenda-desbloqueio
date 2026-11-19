import { carregarStatusPersonalizados } from '../lib/status.js'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Building2, RefreshCcw, Users } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { obterOpcoesAgendamentos } from '../lib/agendamentos.js'
import { atualizarUsuarioAdmin, carregarDashboard, criarUsuarioAdmin, listarEmpresasAdmin, listarNotificacoes, listarUsuariosAdmin, marcarLida, salvarEmpresa } from '../lib/administracao.js'

const STATUSES = [
  ['AGENDADO','status-blue'], ['EM ATENDIMENTO','status-gold'], ['DESBLOQUEADO','status-green'],
  ['CLIENTE NÃO ATENDEU','status-red'], ['REAGENDADO','status-purple'], ['CANCELADO','status-gray'],
]
function Header({ kicker, title, description }) { return <div className="page-intro"><div><span className="eyebrow">{kicker}</span><h2>{title}</h2><p>{description}</p></div></div> }
function Feedback({ error, info }) { return <>{error && <div className="inline-error" role="alert">{error}</div>}{info && <div className="inline-info" role="status">{info}</div>}</> }
const emptyEnterprise = { id:'', nome:'', responsavel_nome:'', telefone:'', email:'', ativa:true }
export function DashboardReal() {
 const [filters,setFilters] = useState({inicio:'',fim:'',empresa:'',responsavel:'',status:'',hora:''})
 const [options,setOptions] = useState({empresas:[],usuarios:[]})
 const [rows,setRows] = useState([])
 const [personalizados,setPersonalizados] = useState([])
 const [error,setError] = useState('')
 const [loading,setLoading] = useState(false)
 const load = useCallback(async () => { setLoading(true); setError(''); try {setRows(await carregarDashboard(filters))} catch(e){setError(e.message)} finally{setLoading(false)} },[filters])
 useEffect(()=>{void load()},[load])
 useEffect(()=>{let alive=true;obterOpcoesAgendamentos().then(x=>{if(alive)setOptions(x)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[])
 useEffect(()=>{let alive=true;carregarStatusPersonalizados().then(x=>{if(alive)setPersonalizados(x)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[])
 const qty = s => Number(rows.find(r=>r.status===s)?.quantidade ?? 0)
 const total = rows.reduce((sum,r)=>sum+Number(r.quantidade),0)
 const set = (k,v)=>setFilters(p=>({...p,[k]:v,...(k==='empresa'?{responsavel:''}:{})}))
 return <div className="page-stack"><Header kicker="VISÃO GERENCIAL" title="Dashboard" description="Indicadores consolidados por data marcada para atendimento, inclusive registros já eliminados da Central."/>
 <section className="panel operation-form"><div className="form-grid">
 <label>Período inicial<input type="date" value={filters.inicio} onChange={e=>set('inicio',e.target.value)}/></label>
 <label>Período final<input type="date" value={filters.fim} onChange={e=>set('fim',e.target.value)}/></label>
 <label>Empresa<select value={filters.empresa} onChange={e=>set('empresa',e.target.value)}><option value="">Todas</option>{options.empresas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
 <label>Responsável<select value={filters.responsavel} onChange={e=>set('responsavel',e.target.value)}><option value="">Todos</option>{options.usuarios.filter(u=>!filters.empresa||u.empresa_id===filters.empresa).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>
 <label>Status<select value={filters.status} onChange={e=>set('status',e.target.value)}><option value="">Todos</option>{[...STATUSES.map(([s])=>s),...personalizados.map(s=>s.nome)].map(s=><option key={s}>{s}</option>)}</select></label>
 <label>Horário<input type="time" step="900" value={filters.hora} onChange={e=>set('hora',e.target.value)}/></label>
 </div><div className="button-row"><button className="btn secondary" type="button" onClick={()=>setFilters({inicio:'',fim:'',empresa:'',responsavel:'',status:'',hora:''})}>Limpar filtros</button><button className="btn secondary" type="button" onClick={load} disabled={loading}><RefreshCcw size={15}/> Atualizar</button></div></section>
 <Feedback error={error}/><div className="stats-grid"><div className="metric-card metric-total"><div className="metric-top">Total de agendamentos</div><strong>{loading?'…':total.toLocaleString('pt-BR')}</strong><small>Histórico agregado</small></div>{STATUSES.map(([s,color])=><div className="metric-card" key={s}><div className="metric-top"><span>{s}</span><span className={'metric-icon '+color}>●</span></div><strong>{loading?'…':qty(s).toLocaleString('pt-BR')}</strong><small>Data de atendimento</small></div>)}</div>
 <div className="notice-strip">O total inclui status personalizados. Os seis cards de status exibem apenas os status originais; a Central mostra somente registros operacionais ainda retidos. Ao filtrar um status, o total também considera apenas esse status.</div></div>
}
export function EmpresasAdmin() {
 const [items,setItems]=useState([]),[edit,setEdit]=useState(emptyEnterprise),[loading,setLoading]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState('')
 const load=useCallback(async()=>{setError('');try{setItems(await listarEmpresasAdmin())}catch(e){setError(e.message)}},[])
 useEffect(()=>{void load()},[load])
 const save=async e=>{e.preventDefault();setLoading(true);setError('');setInfo('');try{await salvarEmpresa(edit);setEdit(emptyEnterprise);setInfo('Empresa salva com sucesso.');await load()}catch(e){setError(e.message)}finally{setLoading(false)}}
 return <div className="page-stack"><Header kicker="ADMINISTRAÇÃO" title="Empresas" description="Cadastro, edição e ativação de empresas. Não há campo CNPJ."/><Feedback error={error} info={info}/>
 <section className="panel operation-form"><h3>{edit.id?'Editar empresa':'Nova empresa'}</h3><form onSubmit={save}><div className="form-grid">
 <label>Nome *<input required minLength={2} value={edit.nome} onChange={e=>setEdit(p=>({...p,nome:e.target.value}))}/></label>
 <label>Responsável<input value={edit.responsavel_nome||''} onChange={e=>setEdit(p=>({...p,responsavel_nome:e.target.value}))}/></label>
 <label>Telefone<input value={edit.telefone||''} onChange={e=>setEdit(p=>({...p,telefone:e.target.value}))}/></label>
 <label>E-mail<input type="email" value={edit.email||''} onChange={e=>setEdit(p=>({...p,email:e.target.value}))}/></label>
 <label>Situação<select value={edit.ativa?'true':'false'} onChange={e=>setEdit(p=>({...p,ativa:e.target.value==='true'}))}><option value="true">Ativa</option><option value="false">Inativa (bloqueia acesso e novos registros)</option></select></label>
 </div><div className="button-row"><button className="btn primary" disabled={loading}>{loading?'Salvando...':'Salvar empresa'}</button>{edit.id&&<button type="button" className="btn secondary" onClick={()=>setEdit(emptyEnterprise)}>Cancelar edição</button>}</div></form></section>
 <section className="panel table-wrap"><table className="central-table"><thead><tr><th>EMPRESA</th><th>RESPONSÁVEL</th><th>STATUS</th><th>AÇÃO</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{x.nome}</td><td>{x.responsavel_nome||'—'}</td><td>{x.ativa?'Ativa':'Inativa'}</td><td><button className="btn secondary btn-small" onClick={()=>{setEdit(x);window.scrollTo({top:0,behavior:'smooth'})}}>Editar</button></td></tr>)}</tbody></table>{items.length===0&&<p className="admin-empty">Nenhuma empresa cadastrada.</p>}</section></div>
}
export function UsuariosAdmin() {
 const {profile}=useAuth(); const general=profile?.perfil==='ADMIN_GERAL'
 const [items,setItems]=useState([]),[companies,setCompanies]=useState([]),[form,setForm]=useState({nome:'',email:'',perfil:'PARCEIRO',empresa_id:general?'':profile?.empresa_id||''})
 const [editing,setEditing]=useState(null),[credentials,setCredentials]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState('')
 const load=useCallback(async()=>{setError('');try{const [us,emps]=await Promise.all([listarUsuariosAdmin(),general?listarEmpresasAdmin():Promise.resolve([])]);setItems(us);setCompanies(emps)}catch(e){setError(e.message)}},[general])
 useEffect(()=>{void load()},[load])
 const set=(k,v)=>setForm(p=>({...p,[k]:v,...(k==='perfil'&&['ADMIN_GERAL','DESBLOQUEIO'].includes(v)?{empresa_id:''}:{})}))
 const create=async e=>{e.preventDefault();setLoading(true);setError('');setInfo('');setCredentials(null);try{const result=await criarUsuarioAdmin(form);setCredentials(result);setForm({nome:'',email:'',perfil:'PARCEIRO',empresa_id:general?'':profile.empresa_id});await load()}catch(e){setError(e.message)}finally{setLoading(false)}}
 const update=async e=>{e.preventDefault();setLoading(true);setError('');setInfo('');try{await atualizarUsuarioAdmin(editing);setEditing(null);setInfo('Usuário atualizado.');await load()}catch(e){setError(e.message)}finally{setLoading(false)}}
 return <div className="page-stack"><Header kicker="ADMINISTRAÇÃO" title="Usuários" description={general?'Gerencie os quatro perfis e seus vínculos.':'Somente Parceiros da sua empresa podem ser cadastrados e editados.'}/><Feedback error={error} info={info}/>
 {credentials&&<section className="panel operation-form"><h3>Conta criada — senha provisória</h3><div className="inline-info">Mostre esta senha ao usuário por um canal seguro. Ela aparece somente nesta resposta e não deve ser copiada para registros ou mensagens comuns.</div><p><strong>E-mail:</strong> {credentials.email}</p><p><strong>Senha provisória:</strong> <code className="secret-code">{credentials.temporary_password}</code></p><button type="button" className="btn secondary" onClick={()=>setCredentials(null)}>Ocultar senha</button></section>}
 <section className="panel operation-form"><h3>Novo usuário</h3><form onSubmit={create}><div className="form-grid">
 <label>Nome *<input required minLength={2} value={form.nome} onChange={e=>set('nome',e.target.value)}/></label>
 <label>E-mail *<input required type="email" value={form.email} onChange={e=>set('email',e.target.value)}/></label>
 {general&&<label>Perfil<select value={form.perfil} onChange={e=>set('perfil',e.target.value)}><option value="PARCEIRO">Parceiro</option><option value="ADMIN_EMPRESA">Administrador da empresa</option><option value="DESBLOQUEIO">Desbloqueio</option><option value="ADMIN_GERAL">Administrador geral</option></select></label>}
 {general&&['PARCEIRO','ADMIN_EMPRESA'].includes(form.perfil)&&<label>Empresa *<select required value={form.empresa_id} onChange={e=>set('empresa_id',e.target.value)}><option value="">Selecione</option>{companies.filter(c=>c.ativa).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>}
 </div><div className="button-row"><button className="btn primary" disabled={loading}>{loading?'Criando...':'Criar usuário com senha provisória'}</button></div></form><p className="admin-help">Exige a Edge Function <code>criar-usuario</code> implantada com autenticação JWT. Nunca inclua a chave <code>service_role</code> no React.</p></section>
 <section className="panel table-wrap"><table className="central-table"><thead><tr><th>NOME</th><th>E-MAIL</th><th>PERFIL</th><th>EMPRESA</th><th>ATIVO</th><th>AÇÃO</th></tr></thead><tbody>{items.map(u=><tr key={u.id}><td>{u.nome}</td><td>{u.email}</td><td>{u.perfil}</td><td>{u.empresa_nome||'Global'}</td><td>{u.ativo?'Sim':'Não'}</td><td><button className="btn secondary btn-small" onClick={()=>setEditing({...u})}>Editar</button></td></tr>)}</tbody></table>{items.length===0&&<p className="admin-empty">Nenhum usuário encontrado.</p>}</section>
 {editing&&<div className="modal-overlay" role="presentation"><section className="detail-modal" role="dialog" aria-modal="true" aria-label="Editar usuário"><h2>Editar usuário</h2><form className="operation-form" onSubmit={update}><div className="form-grid"><label>Nome<input value={editing.nome} minLength={2} required onChange={e=>setEditing(p=>({...p,nome:e.target.value}))}/></label><label>Situação<select value={editing.ativo?'true':'false'} onChange={e=>setEditing(p=>({...p,ativo:e.target.value==='true'}))}><option value="true">Ativo</option><option value="false">Inativo</option></select></label></div><p className="admin-help">Mudança de perfil ou empresa não é permitida nesta edição.</p><div className="button-row"><button className="btn primary" disabled={loading}>Salvar</button><button className="btn secondary" type="button" onClick={()=>setEditing(null)}>Fechar</button></div></form></section></div>}
 </div>
}
export function NotificacoesInternas(){
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(false)
 const load=useCallback(async()=>{setLoading(true);setError('');try{setRows(await listarNotificacoes())}catch(e){setError(e.message)}finally{setLoading(false)}},[])
 useEffect(()=>{void load()},[load])
 const read=async id=>{try{await marcarLida(id);await load()}catch(e){setError(e.message)}}
 return <div className="page-stack"><Header kicker="COMUNICAÇÃO INTERNA" title="Notificações" description="Avisos destinados ao seu perfil, sem envio de mensagens por e-mail ou WhatsApp."/><div className="button-row"><button className="btn secondary" disabled={loading} onClick={load}><RefreshCcw size={15}/> Atualizar</button></div><Feedback error={error}/>
 <section className="panel admin-notifications">{rows.length===0?<p className="admin-empty">Nenhuma notificação recebida.</p>:rows.map(n=><article className={'notification-item '+(!n.lida_em?'unread':'')} key={n.id}><Bell size={20}/><div><strong>{n.titulo}</strong><p>{n.mensagem}</p><small>{new Date(n.criado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</small><div className="button-row">{n.agendamento_id&&<Link to="/central" className="btn secondary btn-small">Abrir Central</Link>}{!n.lida_em&&<button className="btn secondary btn-small" onClick={()=>read(n.id)}>Marcar como lida</button>}</div></div></article>)}</section></div>
}
