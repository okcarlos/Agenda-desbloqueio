import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarPlus, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { criarAgendamento, obterOpcoesAgendamentos } from '../lib/agendamentos.js'

const inicial = { nome: '', cpf: '', telefone: '', proposta: '', data: '', hora: '', observacoes: '' }
const digitos = texto => texto.replace(/\D/g, '')
const formatCpf = texto => digitos(texto).slice(0,11).replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2')
const formatTelefone = texto => {
  const s = digitos(texto).slice(0,11)
  if (s.length < 3) return s
  return `(${s.slice(0,2)}) ${s.slice(2, s.length > 10 ? 7 : 6)}${s.length > (s.length > 10 ? 7 : 6) ? '-' + s.slice(s.length > 10 ? 7 : 6) : ''}`
}
function validoCpf(cpf) {
  const s = digitos(cpf)
  if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false
  const calc = n => { const total = [...s.slice(0,n)].reduce((acc,d,i) => acc + Number(d) * (n + 1 - i), 0); const resto = (total * 10) % 11; return resto === 10 ? 0 : resto }
  return calc(9) === Number(s[9]) && calc(10) === Number(s[10])
}
const dataHoje = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())

export function NovoAgendamento() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(inicial)
  const [empresas, setEmpresas] = useState([])
  const [empresa, setEmpresa] = useState(profile?.empresa_id || '')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [confirmacao, setConfirmacao] = useState(null)
  // A mesma chave é mantida para retries e confirmação, inclusive após timeout.
  const [operacaoId, setOperacaoId] = useState(() => crypto.randomUUID())
  const isAdminGeral = profile?.perfil === 'ADMIN_GERAL'
  useEffect(() => {
    let vivo = true
    obterOpcoesAgendamentos().then(({ empresas: lista }) => {
      if (vivo) { setEmpresas(lista); setCarregando(false) }
    }).catch(e => { if (vivo) { setErro(e.message); setCarregando(false) } })
    return () => { vivo = false }
  }, [])
  const horaValida = useMemo(() => /^([01]\d|2[0-3]):(00|15|30|45)$/.test(form.hora), [form.hora])
  const alterar = (campo, valor) => { setForm(f => ({ ...f, [campo]: valor })); setConfirmacao(null); setOperacaoId(crypto.randomUUID()); setErro('') }
  const enviar = async (avisos = {}) => {
    setErro('')
    if (!empresa) return setErro('Selecione uma empresa válida.')
    if (!form.nome.trim() || !validoCpf(form.cpf) || digitos(form.telefone).length < 10 || !form.proposta.trim()) return setErro('Confira nome, CPF válido, telefone e proposta.')
    if (!form.data || !horaValida) return setErro('Escolha data e horário válido de 15 em 15 minutos.')
    setSalvando(true)
    try {
      const retorno = await criarAgendamento({ ...form, empresaId: empresa, operacaoId }, avisos)
      if (retorno?.situacao === 'CONFIRMACAO_NECESSARIA') { setConfirmacao(retorno); return }
      if (retorno?.situacao !== 'OK') throw new Error('O servidor retornou uma resposta inesperada.')
      navigate('/central', { replace: true, state: { mensagem: retorno.ja_existia ? 'Agendamento já havia sido registrado; nenhum registro duplicado foi criado.' : 'Agendamento registrado com sucesso.' } })
    } catch (e) { setErro(`${e.message} Se houve falha de conexão após salvar, não altere o formulário; tente novamente para conferir a operação.`) }
    finally { setSalvando(false) }
  }
  return <div className="page-stack">
    <div className="page-intro"><div><span className="eyebrow">OPERAÇÃO</span><h2>Novo Agendamento</h2></div><Link className="btn secondary" to="/central">Voltar à Central</Link></div>
    <div className="notice-strip"><ShieldCheck size={18}/> CPF pode ser agendado várias vezes, inclusive no mesmo dia e horário. O sistema apenas avisa sobre repetição; nunca bloqueia por CPF.</div>
    <form className="panel operation-form" onSubmit={e => { e.preventDefault(); void enviar() }}>
      <div className="form-grid">
        <label>Empresa *<select value={empresa} disabled={!isAdminGeral || carregando} onChange={e => { setEmpresa(e.target.value); setConfirmacao(null); setOperacaoId(crypto.randomUUID()) }} required><option value="">Selecione</option>{empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
        <label>Nome completo do cliente *<input required maxLength={160} value={form.nome} onChange={e => alterar('nome',e.target.value)} placeholder="Nome do cliente" /></label>
        <label>CPF *<input required inputMode="numeric" value={form.cpf} onChange={e => alterar('cpf',formatCpf(e.target.value))} placeholder="000.000.000-00" /></label>
        <label>Telefone / WhatsApp *<input required inputMode="tel" value={form.telefone} onChange={e => alterar('telefone',formatTelefone(e.target.value))} placeholder="(11) 99999-9999" /></label>
        <label>Número da proposta *<input required maxLength={80} value={form.proposta} onChange={e => alterar('proposta',e.target.value)} /></label>
        <label>Data do atendimento *<input required type="date" min={dataHoje()} value={form.data} onChange={e => alterar('data',e.target.value)} /></label>
        <label>Horário *<input required type="time" step="900" value={form.hora} onChange={e => alterar('hora',e.target.value)} /></label>
        <label className="full">Observações (opcionais)<textarea rows="4" maxLength={3000} value={form.observacoes} onChange={e => alterar('observacoes',e.target.value)}/></label>
      </div>
      {erro && <p role="alert" className="inline-error">{erro}</p>}
      {confirmacao && <div className="confirmation" role="alertdialog" aria-label="Confirmar avisos"><div className="confirmation-title"><AlertTriangle size={20}/><strong>Confirmação necessária antes de salvar</strong></div>
        {confirmacao.aviso_lotacao && <p>Já existem <strong>{confirmacao.ocupacao}</strong> agendamentos ativos nesse dia e horário, considerando todas as empresas. Você pode continuar.</p>}
        {confirmacao.cpf_duplicado && <p>Este CPF já possui agendamento na mesma data nesta empresa. Você pode continuar.</p>}
        <div className="button-row"><button disabled={salvando} className="btn secondary" type="button" onClick={() => setConfirmacao(null)}>Voltar</button><button disabled={salvando} className="btn primary" type="button" onClick={() => void enviar({ confirmarLotacao: Boolean(confirmacao.aviso_lotacao), contagemConfirmada: confirmacao.ocupacao, confirmarDuplicidade: Boolean(confirmacao.cpf_duplicado) })}>Confirmar e registrar</button></div>
      </div>}
      {!confirmacao && <div className="button-row"><button className="btn primary" type="submit" disabled={salvando || carregando}><CalendarPlus size={18}/>{salvando ? 'Validando e salvando...' : 'Registrar agendamento'}</button></div>}
    </form>
  </div>
}
