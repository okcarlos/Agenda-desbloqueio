import CalendarioMensal from '../components/CalendarioMensal.jsx'
import { carregarStatusPersonalizados, corInline } from '../lib/status.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CalendarPlus, CalendarDays, RefreshCw, Search, List, CalendarRange, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { listarAgendamentos, obterOpcoesAgendamentos, obterDetalhesAgendamento, cancelarAgendamento, reagendarAgendamento, atualizarResultadoAgendamento, registrarTratativaAgendamento } from '../lib/agendamentos.js'

const STATUS = ['AGENDADO','EM ATENDIMENTO','DESBLOQUEADO','CLIENTE NÃO ATENDEU','REAGENDADO','CANCELADO']
const CORES = ['status-blue','status-gold','status-green','status-red','status-purple','status-gray']
const corStatus = s => CORES[STATUS.indexOf(s)] || ''
const formatData = s => s ? s.split('-').reverse().join('/') : '—'
const formatHora = h => h?.slice(0,5) || '—'
const dataHoje = () => new Intl.DateTimeFormat('en-CA',{ timeZone:'America/Sao_Paulo', year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const dataHora = s => s ? new Date(s).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}) : '—'
const letras = s => [...(s || '')].filter(c => /\p{L}/u.test(c)).length

function ModalDetalhes({ id, nomes, perfil, usuarioId, onClose, onChanged, personalizados }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [busy, setBusy] = useState(false)
  const [modo, setModo] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [nota, setNota] = useState('')
  const [novoDia, setNovoDia] = useState('')
  const [novaHora, setNovaHora] = useState('')
  const [confirmar, setConfirmar] = useState(null)
  const carregar = useCallback(async () => { try { setDados(await obterDetalhesAgendamento(id)); setErro('') } catch(e) { setErro(e.message) } }, [id])
  useEffect(() => { void carregar() }, [carregar])
  const a = dados?.agendamento
  const podeResultado = ['ADMIN_GERAL','ADMIN_EMPRESA','DESBLOQUEIO'].includes(perfil)
  const podeEditar = perfil !== 'PARCEIRO' || a?.criado_por_usuario_id === usuarioId
  const atualCustom = personalizados.find(s=>s.nome===a?.status)
  // CLIENTE NÃO ATENDEU continua editável durante os 7 dias de retenção.
  // Os demais status encerrados permanecem terminais.
  const aberto = Boolean(a) && (
    a.status === 'CLIENTE NÃO ATENDEU' ||
    (!a.excluir_apos && !['CANCELADO', 'DESBLOQUEADO'].includes(a.status) &&
      (!atualCustom || atualCustom.comportamento === 'ATIVO'))
  )
  const destinos = [
    ...STATUS.filter(s => s !== 'CANCELADO'),
    ...personalizados.filter(s => s.ativo).map(s => s.nome)
  ].filter(s => s !== a?.status)
  const rodar = async operacao => {
    setBusy(true); setErro('')
    try {
      const retorno = await operacao()
      if (retorno?.situacao === 'CONFIRMACAO_NECESSARIA') { setConfirmar(retorno); return }
      setModo(''); setConfirmar(null); setJustificativa(''); setNota('')
      await carregar(); await onChanged()
    } catch(e) { setErro(e.message + ' Atualize os detalhes antes de repetir uma ação que possa ter sido concluída.') }
    finally { setBusy(false) }
  }
  const resultado = (s) => rodar(() => atualizarResultadoAgendamento(a.id, a.versao, s))
  const reagendar = avisos => rodar(() => reagendarAgendamento(a.id,a.versao,novoDia,novaHora,avisos))
  return <div className="modal-overlay" onMouseDown={e => { if(e.target===e.currentTarget) onClose() }}><section className="detail-modal" role="dialog" aria-modal="true" aria-label="Detalhes do agendamento"><div className="modal-head"><div><span className="eyebrow">DETALHES</span><h2>Agendamento</h2></div><button className="icon-btn" type="button" aria-label="Fechar" onClick={onClose}><X/></button></div>
    {erro && <p className="inline-error" role="alert">{erro}</p>}{!a ? <p>Carregando dados autorizados...</p> : <>
    <div className="detail-grid"><div><small>Cliente</small><strong>{a.cliente_nome}</strong></div><div><small>CPF</small><strong>{a.cliente_cpf}</strong></div><div><small>Telefone</small><strong>{a.cliente_telefone}</strong></div><div><small>Proposta</small><strong>{a.numero_proposta}</strong></div><div><small>Empresa</small><strong>{nomes.empresas[a.empresa_id] || 'Empresa'}</strong></div><div><small>Responsável</small><strong>{nomes.usuarios[a.responsavel_usuario_id] || 'Usuário'}</strong></div><div><small>Atendimento</small><strong>{formatData(a.data_atendimento)} · {formatHora(a.hora_atendimento)}</strong></div><div><small>Status</small><span className={`status-pill ${corStatus(a.status)}`} style={corInline(a.status,personalizados)}>{a.status}</span></div><div className="full"><small>Observações</small><p>{a.observacoes || 'Sem observações'}</p></div></div>
    {aberto && <div className="button-row detail-actions">
      {podeResultado && <label className="status-select-label">Alterar status
        <select
          key={`${a.id}-${a.versao}`}
          defaultValue=""
          disabled={busy}
          onChange={e => {
            const destino = e.target.value
            e.target.value = ''
            if (destino) void resultado(destino)
          }}
        >
          <option value="">Escolha um status</option>
          {destinos.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>}
      {podeEditar && <>
        <button className="btn secondary" disabled={busy} onClick={() => {setModo('reagendar');setConfirmar(null)}}>Reagendar</button>
        <button className="btn secondary" disabled={busy} onClick={() => setModo('cancelar')}>Cancelar</button>
      </>}
    </div>}
    {a && !aberto && <p className="notice-strip" role="status">Este agendamento está encerrado e não permite novas alterações de status.</p>}
    {modo==='reagendar' && <div className="modal-action"><h3>Reagendar atendimento</h3><div className="form-grid"><label>Data<input type="date" min={dataHoje()} value={novoDia} onChange={e=>{setNovoDia(e.target.value);setConfirmar(null)}}/></label><label>Horário<input type="time" step="900" value={novaHora} onChange={e=>{setNovaHora(e.target.value);setConfirmar(null)}}/></label></div>{confirmar && <div className="confirmation"><p>Há <strong>{confirmar.ocupacao}</strong> agendamentos ativos nesse horário. O reagendamento continua permitido.</p><button className="btn primary" disabled={busy} onClick={() => void reagendar({confirmarLotacao:true,contagemConfirmada:confirmar.ocupacao})}>Confirmar mesmo assim</button></div>}<div className="button-row"><button className="btn secondary" onClick={()=>setModo('')}>Voltar</button><button className="btn primary" disabled={busy || !novoDia || !/^([01]\d|2[0-3]):(00|15|30|45)$/.test(novaHora)} onClick={()=>void reagendar({})}>Salvar reagendamento</button></div></div>}
    {modo==='cancelar' && <div className="modal-action"><h3>Cancelar agendamento</h3><label>Justificativa (mínimo de 5 letras)<textarea value={justificativa} rows="3" onChange={e=>setJustificativa(e.target.value)}/></label><div className="button-row"><button className="btn secondary" onClick={()=>setModo('')}>Voltar</button><button className="btn primary" disabled={busy || letras(justificativa)<5} onClick={()=>void rodar(()=>cancelarAgendamento(a.id,a.versao,justificativa))}>Confirmar cancelamento</button></div></div>}
    {podeResultado && <div className="modal-action"><h3>Registrar tratativa</h3><textarea rows="2" value={nota} onChange={e=>setNota(e.target.value)} placeholder="Observação sobre o atendimento"/><button className="btn secondary" disabled={busy || !nota.trim()} onClick={()=>void rodar(()=>registrarTratativaAgendamento(a.id,nota))}>Adicionar tratativa</button></div>}
    <div className="timeline"><h3>Histórico</h3>{dados.historico.length===0 && <p>Nenhum evento disponível.</p>}{dados.historico.map((h,i)=><div className="timeline-item" key={i}><strong>{h.tipo_evento}</strong><small>{dataHora(h.criado_em)} · {nomes.usuarios[h.usuario_id] || 'Usuário'}</small><p>{h.justificativa || [h.dados_anteriores?.status, h.dados_novos?.status].filter(Boolean).join(' → ') || `${formatData(h.dados_novos?.data)} ${formatHora(h.dados_novos?.hora)}`}</p></div>)}<h3>Tratativas</h3>{dados.tratativas.length===0 && <p>Sem tratativas.</p>}{dados.tratativas.map(t=><div className="timeline-item" key={t.id}><small>{dataHora(t.criado_em)} · {nomes.usuarios[t.usuario_id] || 'Usuário'}</small><p>{t.observacao}</p></div>)}</div>
    </>}
  </section></div>
}

export function CentralReal() {
  const { profile, user } = useAuth()
  const location = useLocation()
  const [dados, setDados] = useState({ registros:[],total:0,pagina:1 })
  const [filtros, setFiltros] = useState({ empresaId:'',responsavelId:'',status:'',inicio:'',fim:'',hora:'',busca:'' })
  const [aplicados, setAplicados] = useState(filtros)
  const [pagina, setPagina] = useState(1)
  const [opcoes,setOpcoes] = useState({empresas:[],usuarios:[]})
  const [personalizados,setPersonalizados] = useState([])
  const [modal,setModal] = useState(null)
  const [view,setView] = useState('table')
  const [refreshCalendario,setRefreshCalendario] = useState(0)
  const [erro,setErro] = useState('')
  const [carregando,setCarregando] = useState(false)
  const [alertaTempoReal,setAlertaTempoReal] = useState(false)
  const [mensagem,setMensagem] = useState(location.state?.mensagem || '')
  const podeCriar = ['ADMIN_GERAL','ADMIN_EMPRESA','PARCEIRO'].includes(profile?.perfil)
  const carregar = useCallback(async () => { setCarregando(true); try { setDados(await listarAgendamentos({...aplicados,pagina})); setErro(''); setAlertaTempoReal(false) } catch(e) { setErro(e.message) } finally { setCarregando(false) } },[aplicados,pagina])
  useEffect(() => { void carregar() },[carregar])
  useEffect(()=>{let ativo=true;carregarStatusPersonalizados().then(s=>{if(ativo)setPersonalizados(s)}).catch(e=>{if(ativo)setErro(e.message)});return()=>{ativo=false}},[])
  useEffect(() => { let ativo=true; obterOpcoesAgendamentos().then(r=>{if(ativo)setOpcoes(r)}).catch(e=>{if(ativo)setErro(e.message)});return()=>{ativo=false}},[])
  // A assinatura só é aberta com empresa definida; nunca abrir feed de todas as empresas.
  const empresaAssinada = ['ADMIN_EMPRESA','PARCEIRO'].includes(profile?.perfil) ? profile?.empresa_id : aplicados.empresaId
  useEffect(() => {
    if (!empresaAssinada) return
    const canal = supabase.channel(`ieva-central-${empresaAssinada}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'agendamentos',filter:`empresa_id=eq.${empresaAssinada}`},()=>setAlertaTempoReal(true))
      .subscribe()
    return () => { void supabase.removeChannel(canal) }
  },[empresaAssinada])
  const nomes = useMemo(() => ({empresas:Object.fromEntries(opcoes.empresas.map(e=>[e.id,e.nome])),usuarios:Object.fromEntries(opcoes.usuarios.map(u=>[u.id,u.nome]))}),[opcoes])
  const atualizarFiltro = (k,v) => setFiltros(f=>({...f,[k]:v}))
  const aplicar = e => { e.preventDefault(); setPagina(1); setAplicados({...filtros}); setRefreshCalendario(k=>k+1) }
  const selecionarDia = dia => { const novos={...filtros,inicio:dia,fim:dia};setFiltros(novos);setAplicados(novos);setPagina(1);setView('table') }
  return <div className="page-stack"><div className="page-intro"><div><span className="eyebrow">OPERAÇÃO</span><h2>Central de Agendamentos</h2><p>Consulta autorizada com 25 registros por página. Visualização em tabela ou calendário.</p></div>{podeCriar && <Link className="btn primary" to="/novo-agendamento"><CalendarPlus size={18}/> Novo Agendamento</Link>}</div>
    {mensagem && <div className="notice-strip" role="status">{mensagem} <button type="button" className="icon-btn" onClick={()=>setMensagem('')} aria-label="Dispensar"><X size={15}/></button></div>}
    {erro && <p className="inline-error" role="alert">{erro}</p>}
    {alertaTempoReal && <div className="notice-strip">Há alterações nessa empresa. <button className="btn secondary" onClick={()=>void carregar()}>Atualizar registros</button></div>}
    <section className="panel central-panel"><form className="central-filters" onSubmit={aplicar}><label className="filter-search"><Search size={16}/><input value={filtros.busca} onChange={e=>atualizarFiltro('busca',e.target.value)} placeholder="Cliente, CPF ou proposta" /></label>
      {['ADMIN_GERAL','DESBLOQUEIO'].includes(profile?.perfil) && <label>Empresa<select value={filtros.empresaId} onChange={e=>atualizarFiltro('empresaId',e.target.value)}><option value="">Todas</option>{opcoes.empresas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>}
      <label>Responsável<select value={filtros.responsavelId} onChange={e=>atualizarFiltro('responsavelId',e.target.value)}><option value="">Todos</option>{opcoes.usuarios.filter(u=>!filtros.empresaId || u.empresa_id===filtros.empresaId).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>
      <label>Status<select value={filtros.status} onChange={e=>atualizarFiltro('status',e.target.value)}><option value="">Todos</option>{[...STATUS,...personalizados.map(s=>s.nome)].map(s=><option key={s}>{s}</option>)}</select></label>
      <label>De<input type="date" value={filtros.inicio} onChange={e=>atualizarFiltro('inicio',e.target.value)}/></label><label>Até<input type="date" value={filtros.fim} onChange={e=>atualizarFiltro('fim',e.target.value)}/></label><label>Horário<input type="time" step="900" value={filtros.hora} onChange={e=>atualizarFiltro('hora',e.target.value)}/></label><button className="btn primary" type="submit">Filtrar</button></form>
    <div className="central-toolbar"><button className="btn secondary" type="button" disabled={carregando} onClick={()=>void carregar()}><RefreshCw size={16}/>{carregando?'Atualizando...':'Atualizar'}</button><div className="segmented-tabs"><button type="button" className={view==='table'?'selected':''} onClick={()=>setView('table')}><List size={17}/> Tabela</button><button type="button" className={view==='calendar'?'selected':''} onClick={()=>setView('calendar')}><CalendarRange size={17}/> Calendário</button></div></div>
    {view==='table' ? <div className="table-wrap"><table className="central-table"><thead><tr>{['DATA','HORA','CLIENTE','PROPOSTA','EMPRESA','RESPONSÁVEL','STATUS','AÇÕES'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{dados.registros.map(a=><tr key={a.id}><td>{formatData(a.data_atendimento)}</td><td>{formatHora(a.hora_atendimento)}</td><td>{a.cliente_nome}</td><td>{a.numero_proposta}</td><td>{nomes.empresas[a.empresa_id]||'—'}</td><td>{nomes.usuarios[a.responsavel_usuario_id]||'—'}</td><td><span className={`status-pill ${corStatus(a.status)}`} style={corInline(a.status,personalizados)}>{a.status}</span></td><td><button type="button" className="btn secondary btn-small" onClick={()=>setModal(a.id)}>Detalhes</button></td></tr>)}</tbody></table>{!dados.registros.length && <div className="table-empty"><CalendarDays size={28}/><h3>Nenhum agendamento encontrado</h3><p>Verifique os filtros ou crie um agendamento autorizado.</p></div>}</div> : <CalendarioMensal filtros={aplicados} personalizados={personalizados} onSelectDia={selecionarDia} refreshKey={refreshCalendario}/>}
    <div className="central-footer"><span>{dados.total} registro(s) autorizado(s) · Página {pagina} de {Math.max(1,Math.ceil(dados.total/25))}</span><div className="button-row"><button className="btn secondary btn-small" disabled={pagina===1 || carregando} onClick={()=>setPagina(p=>p-1)}>Anterior</button><button className="btn secondary btn-small" disabled={pagina*25>=dados.total || carregando} onClick={()=>setPagina(p=>p+1)}>Próxima</button></div></div></section>
    <div className="status-legend"><strong>Status do sistema</strong><div>{[...STATUS,...personalizados.map(s=>s.nome)].map(s=><span className={`status-pill ${corStatus(s)}`} style={corInline(s,personalizados)} key={s}>{s}</span>)}</div></div>
    {modal && <ModalDetalhes id={modal} nomes={nomes} perfil={profile?.perfil} usuarioId={user?.id} onClose={()=>setModal(null)} onChanged={carregar} personalizados={personalizados}/>}
  </div>
}
