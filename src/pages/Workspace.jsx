import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight, CalendarDays, CalendarPlus, CheckCircle2, Clock3,
  CalendarClock, Filter, Search, ShieldCheck, Users, Ban,
  UserRoundX, Lock, CircleHelp, List, CalendarRange, Building2,
} from 'lucide-react'
import { perfilLabel, useAuth } from '../auth/AuthContext.jsx'

const statuses = [
  { label: 'AGENDADO', icon: CalendarDays, color: 'status-blue' },
  { label: 'EM ATENDIMENTO', icon: Clock3, color: 'status-gold' },
  { label: 'DESBLOQUEADO', icon: CheckCircle2, color: 'status-green' },
  { label: 'CLIENTE NÃO ATENDEU', icon: UserRoundX, color: 'status-red' },
  { label: 'REAGENDADO', icon: CalendarClock, color: 'status-purple' },
  { label: 'CANCELADO', icon: Ban, color: 'status-gray' },
]

function PageIntro({ kicker, title, description, children }) {
  return <div className="page-intro"><div><span className="eyebrow">{kicker}</span><h2>{title}</h2><p>{description}</p></div>{children}</div>
}

function InProgress({ title, description }) {
  return <div className="panel empty-state"><div className="empty-icon"><Lock size={23} /></div><h3>{title}</h3><p>{description}</p><span className="development-label">Estrutura visual pronta · módulo não liberado</span></div>
}

export function Dashboard() {
  return <div className="page-stack">
    <PageIntro kicker="VISÃO GERENCIAL" title="Visão geral da operação" description="Sete indicadores aprovados, com estatísticas históricas por data de atendimento." />
    <div className="notice-strip"><ShieldCheck size={18} />Indicadores exibidos sem números fictícios. As consultas e filtros serão conectados à agregação segura do PostgreSQL na próxima etapa.</div>
    <div className="filters panel"><div className="filters-heading"><Filter size={18}/><strong>Filtros do painel</strong></div><div className="filter-chips"><span>Período</span><span>Empresa</span><span>Responsável</span><span>Status</span><span>Horário</span></div></div>
    <div className="stats-grid">
      <div className="metric-card metric-total"><div className="metric-top"><span>Total de agendamentos</span><CalendarDays size={22}/></div><strong>—</strong><small>Aguardando dados autorizados</small></div>
      {statuses.map(({ label, icon: Icon, color }) => <div className="metric-card" key={label}><div className="metric-top"><span>{label}</span><span className={`metric-icon ${color}`}><Icon size={19}/></span></div><strong>—</strong><small>Aguardando dados autorizados</small></div>)}
    </div>
    <InProgress title="Consultas gerenciais em preparação" description="A próxima etapa implementará contadores reais, filtros no banco e preservação de agregados após os sete dias de retenção." />
  </div>
}

export function Central() {
  const { profile } = useAuth()
  const canCreate = ['ADMIN_GERAL', 'ADMIN_EMPRESA', 'PARCEIRO'].includes(profile?.perfil)
  const [view, setView] = useState('table')
  return <div className="page-stack">
    <PageIntro kicker="OPERAÇÃO" title="Central de Agendamentos" description="Uma única central para consultar, acompanhar e administrar atendimentos.">
      {canCreate && <Link to="/novo-agendamento" className="btn primary"><CalendarPlus size={18}/> Novo Agendamento</Link>}
    </PageIntro>
    <div className="notice-strip"><ShieldCheck size={18}/>Nenhum registro de cliente é exibido até a implementação das regras de acesso e dos procedimentos de agendamento.</div>
    <section className="panel central-panel"><div className="central-toolbar"><div className="filter-row"><div className="search-placeholder"><Search size={18}/><span>Busca por cliente, CPF ou proposta</span></div><div className="filter-chip"><Filter size={17} /> Filtros</div></div><div className="segmented-tabs" aria-label="Visualização"><button className={view === 'table' ? 'selected' : ''} type="button" onClick={() => setView('table')}><List size={17}/> Tabela</button><button className={view === 'calendar' ? 'selected' : ''} type="button" onClick={() => setView('calendar')}><CalendarRange size={17}/> Calendário</button></div></div>
      <div className="table-wrap">{view === 'table' ? <table className="central-table"><thead><tr><th>DATA</th><th>HORA</th><th>CLIENTE</th><th>PROPOSTA</th><th>EMPRESA</th><th>RESPONSÁVEL</th><th>STATUS</th><th>AÇÕES</th></tr></thead></table> : <div className="calendar-preview"><CalendarRange size={36}/><h3>Visualização em calendário</h3><p>Grade de 15 minutos disponível após a implementação dos agendamentos.</p></div>}</div>
      {view === 'table' && <div className="table-empty"><CalendarDays size={28}/><h3>Nenhum dado carregado</h3><p>A Central terá paginação de 25 registros e atualização em tempo real filtrada por autorização.</p></div>}
      <div className="central-footer"><span>0 registros apresentados nesta etapa</span><span>Paginação: 25 registros por página <CircleHelp size={15}/></span></div>
    </section>
    <div className="status-legend"><strong>Status oficiais</strong><div>{statuses.map(s => <span className={`status-pill ${s.color}`} key={s.label}>{s.label}</span>)}</div></div>
  </div>
}

export function ComingSoon({ name }) {
  const map = {
    'Novo Agendamento': 'O formulário respeitará horários a cada 15 minutos, aviso a partir do sexto agendamento, CPF duplicado e confirmações transacionais.',
    'Empresas': 'Cadastro e gestão das empresas, sem CNPJ, exclusivo do Administrador geral.',
    'Usuários': 'Criação e gestão de usuários com permissões por empresa, senha provisória e troca obrigatória.',
    'Backup do Sistema': 'O backup manual será realizado por serviço protegido no servidor, com criptografia e download somente para o Administrador geral.',
    'Notificações internas': 'Eventos internos no sino com destinatários específicos e sem avisos por e-mail ou WhatsApp.',
  }
  return <div className="page-stack"><PageIntro kicker="PRÓXIMA ETAPA" title={name} description={map[name] || 'Funcionalidade prevista no documento de requisitos.'} /><InProgress title={`${name} ainda não habilitado`} description="Não haverá botões que simulem gravações ou permissões antes de existir a rotina segura correspondente no PostgreSQL/Supabase." /></div>
}

export function MyAccount() {
  const { profile, user } = useAuth()
  return <div className="page-stack">
    <PageIntro kicker="ACESSO E SEGURANÇA" title="Minha Conta" description="Informações do usuário autenticado e opções pessoais de segurança." />
    <div className="account-layout"><section className="panel account-panel"><div className="account-avatar">{(profile?.nome || 'U')[0].toUpperCase()}</div><h3>{profile?.nome || 'Usuário'}</h3><p>{perfilLabel[profile?.perfil]}</p><div className="account-fields"><div><span>E-mail</span><strong>{profile?.email || user?.email}</strong></div><div><span>Empresa</span><strong>{profile?.empresa_nome || 'Acesso global'}</strong></div><div><span>Situação</span><strong>Ativo</strong></div></div></section>
      <section className="panel account-security"><div className="account-security-header"><ShieldCheck size={24}/><div><h3>Segurança da conta</h3><p>Você pode atualizar sua senha de acesso a qualquer momento.</p></div></div><Link to="/alterar-senha" className="btn secondary">Alterar minha senha <ArrowUpRight size={17}/></Link><div className="security-tip"><Lock size={17}/> Nunca compartilhe sua senha com outras pessoas.</div></section>
    </div>
  </div>
}
