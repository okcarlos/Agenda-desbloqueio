import { useCallback, useEffect, useState } from 'react'
import { PADRAO, carregarStatusPersonalizados, salvarStatusPersonalizado, corInline} from '../lib/status.js'

const vazio = () => ({ id:null,nome:'',cor:'#6885F6',comportamento:'ATIVO',ocupa_horario:false,origens:['EM ATENDIMENTO'],ativo:true })
export default function GerenciarStatus() {
  const [items,setItems] = useState([])
  const [form,setForm] = useState(vazio)
  const [erro,setErro] = useState('')
  const [info,setInfo] = useState('')
  const [busy,setBusy] = useState(false)
  const carregar = useCallback(async () => { try {setItems(await carregarStatusPersonalizados())} catch(e) {setErro(e.message)} },[])
  useEffect(()=>{void carregar()},[carregar])
  const set = (k,v) => setForm(f=>({...f,[k]:v,...(k==='comportamento'&&v!=='ATIVO'?{ocupa_horario:false}:{})}))
  const enviar = async e => {
    e.preventDefault(); setBusy(true); setErro(''); setInfo('')
    try {
      await salvarStatusPersonalizado(form)
      setInfo('Status salvo. A mudança foi registrada na auditoria.')
      setForm(vazio()); await carregar()
    } catch(e) {setErro(e.message)} finally {setBusy(false)}
  }
  return <div className="page-stack">
    <div className="page-intro"><div><span className="eyebrow">ADMINISTRAÇÃO</span><h2>Gerenciar Status</h2><p>Adicione status personalizados. Transições são livres entre status não encerrados, respeitando as permissões.</p></div></div>
    {erro&&<p className="inline-error" role="alert">{erro}</p>}{info&&<p className="inline-info" role="status">{info}</p>}
    <section className="panel operation-form"><h3>{form.id?'Editar status':'Novo status personalizado'}</h3>
      <form onSubmit={enviar}><div className="form-grid">
      <label>Nome do status *<input maxLength={50} required minLength={3} value={form.nome} onChange={e=>set('nome',e.target.value)} /></label>
      <label>Cor *<input type="color" value={form.cor} onChange={e=>set('cor',e.target.value)} /></label>
      <label>Comportamento *<select value={form.comportamento} onChange={e=>set('comportamento',e.target.value)}><option value="ATIVO">Ativo (continua em atendimento)</option><option value="CONCLUIDO">Concluído (eliminar após 7 dias)</option><option value="ENCERRADO">Encerrado (eliminar após 7 dias)</option></select></label>
      <label>Situação<select value={String(form.ativo)} onChange={e=>set('ativo',e.target.value==='true')}><option value="true">Ativo para novas alterações</option><option value="false">Inativo para novas alterações</option></select></label>
      <label className="full"><input type="checkbox" checked={form.ocupa_horario} disabled={form.comportamento!=='ATIVO'} onChange={e=>set('ocupa_horario',e.target.checked)}/> Contar como ocupação do horário (somente para status ativos)</label>
      <p className="full">Status ativos podem receber alterações a partir de qualquer outro status não terminal, inclusive CLIENTE NÃO ATENDEU. As regras são validadas no banco.</p>
      </div><div className="button-row"><button className="btn primary" disabled={busy||form.origens.length===0}>{busy?'Salvando...':'Salvar status'}</button>{form.id&&<button type="button" className="btn secondary" onClick={()=>setForm(vazio())}>Cancelar edição</button>}</div></form>
      <p>DESBLOQUEADO, CANCELADO e status personalizados CONCLUIDO/ENCERRADO não podem ser alterados após o encerramento. CLIENTE NÃO ATENDEU pode ser alterado até sua exclusão após sete dias. Status vinculados preservam suas regras de integridade.</p>
    </section>
    <section className="panel operation-form"><h3>Seis status padrão (protegidos)</h3><div className="status-legend"><div>{PADRAO.map(s=><span key={s.nome} className="status-pill" style={corInline(s.nome, items)}>{s.nome}</span>)}</div></div></section>
    <section className="panel table-wrap"><table className="central-table"><thead><tr><th>STATUS</th><th>COMPORTAMENTO</th><th>OCUPAÇÃO</th><th>SITUAÇÃO</th><th>AÇÃO</th></tr></thead><tbody>{items.map(s=><tr key={s.id}><td><span className="status-pill" style={corInline(s.nome, items)}>{s.nome}</span></td><td>{s.comportamento}</td><td>{s.ocupa_horario?'Sim':'Não'}</td><td>{s.ativo?'Ativo':'Inativo'}</td><td><button className="btn secondary btn-small" onClick={()=>{setForm({...s});window.scrollTo({top:0,behavior:'smooth'})}}>Editar</button></td></tr>)}</tbody></table>{!items.length&&<p className="admin-empty">Nenhum status adicional cadastrado.</p>}</section>
  </div>
}
