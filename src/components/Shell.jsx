import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, Building2, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight,
  LayoutDashboard, LogOut, Menu, PanelLeftClose, ShieldCheck, UserCircle2,
  Users, X, Tags,
} from 'lucide-react'
import { perfilLabel, useAuth } from '../auth/AuthContext.jsx'
import logoIevAvanca from "../Assets/Logo.jpeg";

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, allowed: ['ADMIN_GERAL', 'DESBLOQUEIO'] },
  { to: '/central', label: 'Central de Agendamentos', icon: CalendarDays, allowed: ['ADMIN_GERAL', 'ADMIN_EMPRESA', 'PARCEIRO', 'DESBLOQUEIO'] },
  { to: '/novo-agendamento', label: 'Novo Agendamento', icon: CalendarPlus, allowed: ['ADMIN_GERAL', 'ADMIN_EMPRESA', 'PARCEIRO'] },
  { to: '/empresas', label: 'Empresas', icon: Building2, allowed: ['ADMIN_GERAL'] },
  { to: '/usuarios', label: 'Usuários', icon: Users, allowed: ['ADMIN_GERAL', 'ADMIN_EMPRESA'] },
  { to: '/status', label: 'Gerenciar Status', icon: Tags, allowed: ['ADMIN_GERAL'] },
  { to: '/backup', label: 'Backup do Sistema', icon: ShieldCheck, allowed: ['ADMIN_GERAL'] },
]

const titleByPath = {
  '/dashboard': 'Dashboard',
  '/central': 'Central de Agendamentos',
  '/novo-agendamento': 'Novo Agendamento',
  '/empresas': 'Empresas',
  '/usuarios': 'Usuários',
  '/backup': 'Backup do Sistema',
  '/status': 'Gerenciar Status',
  '/minha-conta': 'Minha Conta',
  '/notificacoes': 'Notificações',
  '/alterar-senha': 'Alterar Senha',
}

export function Shell() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const canReceiveNotifications = ['ADMIN_EMPRESA', 'DESBLOQUEIO'].includes(profile?.perfil)
  const visibleItems = navigation.filter(item => item.allowed.includes(profile?.perfil))

  const logout = async () => {
    setLogoutError('')
    try { await signOut(); navigate('/login', { replace: true }) }
    catch { setLogoutError('Não foi possível encerrar a sessão. Tente novamente.') }
  }

  return <div className={`app-layout ${collapsed ? 'nav-collapsed' : ''}`}>
    {mobileOpen && <button type="button" className="mobile-overlay" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand-row">
        <Link to="/" className="brand" onClick={() => setMobileOpen(false)}>
          <div className="brand-logo">
            <img src={logoIevAvanca} alt="I&V Avança" />
          </div>
          <span className="brand-name"><strong>I&V Avança</strong><small>Agendamentos</small></span>
        </Link>
        <button type="button" className="icon-btn sidebar-close-mobile" aria-label="Fechar menu" onClick={() => setMobileOpen(false)}><X size={20} /></button>
      </div>
      <div className="sidebar-separator" />
      <p className="nav-caption">MENU PRINCIPAL</p>
      <nav className="nav-list" aria-label="Menu principal">
        {visibleItems.map(item => <NavLink
          key={item.to} to={item.to} end
          title={item.label} onClick={() => setMobileOpen(false)}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <item.icon size={19} strokeWidth={1.8} />
          <span>{item.label}</span>
        </NavLink>)}
      </nav>
      <div className="sidebar-footer">
        <NavLink to="/minha-conta" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Minha Conta" onClick={() => setMobileOpen(false)}>
          <UserCircle2 size={19} /><span>Minha Conta</span>
        </NavLink>
        <button type="button" className="nav-link sidebar-collapse-btn" onClick={() => setCollapsed(value => !value)} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {collapsed ? <ChevronRight size={19} /> : <PanelLeftClose size={19} />}
          <span>Recolher menu</span>
        </button>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="topbar-heading">
          <button type="button" className="icon-btn hamburger" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
          <div><span className="eyebrow">SISTEMA I&V AVANÇA</span><h1>{titleByPath[location.pathname] || 'IEV Avança'}</h1></div>
        </div>
        <div className="topbar-actions">
          {canReceiveNotifications && <Link to="/notificacoes" title="Notificações" className="icon-btn bell-btn"><Bell size={20} /><span className="sr-only">Notificações</span></Link>}
          <span className="topbar-divider" />
          <Link to="/minha-conta" className="user-profile">
            <span className="avatar">{(profile?.nome || 'U').slice(0, 1).toUpperCase()}</span>
            <span className="user-profile-label"><strong>{profile?.nome}</strong><small>{perfilLabel[profile?.perfil]}</small></span>
            <ChevronLeft size={15} className="user-chevron" />
          </Link>
          <button className="icon-btn" type="button" onClick={logout} title="Sair" aria-label="Sair"><LogOut size={19} /></button>
        </div>
      </header>
      {logoutError && <div role="alert" className="inline-error global-error">{logoutError}</div>}
      <main className="main-content"><Outlet /></main>
    </div>
  </div>
}
