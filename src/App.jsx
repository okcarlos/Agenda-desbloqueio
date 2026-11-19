import GerenciarStatus from './pages/GerenciarStatus.jsx'
import BackupSistema from './pages/BackupSistema.jsx'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AlertTriangle, LoaderCircle, Settings2 } from 'lucide-react'
import { configurationProblem } from './lib/supabase.js'
import { defaultRouteFor, useAuth } from './auth/AuthContext.jsx'
import { Shell } from './components/Shell.jsx'
import { Login, RequestRecovery } from './pages/Login.jsx'
import { PasswordChange } from './pages/PasswordChange.jsx'
import { Dashboard, ComingSoon, MyAccount } from './pages/Workspace.jsx'
import { CentralReal } from './pages/CentralReal.jsx'
import { NovoAgendamento } from './pages/NovoAgendamento.jsx'
import { DashboardReal, EmpresasAdmin, UsuariosAdmin, NotificacoesInternas } from './pages/AdminEtapa4.jsx'

function Waiting() {
  return <div className="fullscreen-centered"><LoaderCircle className="spin" size={30} /><p>Validando seu acesso...</p></div>
}

function StateMessage({ icon: Icon = AlertTriangle, title, detail, action, actionLabel }) {
  return <div className="fullscreen-centered"><div className="state-card">
    <span className="state-icon"><Icon size={26} /></span>
    <h1>{title}</h1><p>{detail}</p>
    {action && <button className="btn primary" type="button" onClick={action}>{actionLabel}</button>}
  </div></div>
}

function Guard() {
  const { loading, user, profile, error, refresh, signOut } = useAuth()
  if (loading) return <Waiting />
  if (!user) return <Navigate to="/login" replace />
  if (error) return <StateMessage title="Não foi possível verificar seu acesso" detail={error} action={refresh} actionLabel="Tentar novamente" />
  if (!profile) return <StateMessage title="Perfil não cadastrado" detail="Esta conta existe no Auth, mas não está habilitada no Sistema IEV Avança. Contate o Administrador geral." action={signOut} actionLabel="Sair" />
  if (!profile.ativo || !profile.empresa_ativa) return <StateMessage title="Acesso desativado" detail="Sua conta ou empresa está inativa. Consulte o Administrador geral." action={signOut} actionLabel="Sair" />
  if (profile.troca_senha_pendente) return <Navigate to="/trocar-senha" replace />
  return <Outlet />
}

function AllowRoles({ allowed, children }) {
  const { profile } = useAuth()
  return allowed.includes(profile?.perfil) ? children : <Navigate to={defaultRouteFor(profile?.perfil)} replace />
}

function RootRedirect() {
  const { loading, user, profile } = useAuth()
  if (loading) return <Waiting />
  if (!user) return <Navigate to="/login" replace />
  if (!profile || !profile.ativo || !profile.empresa_ativa) return <Navigate to="/acesso" replace />
  if (profile.troca_senha_pendente) return <Navigate to="/trocar-senha" replace />
  return <Navigate to={defaultRouteFor(profile.perfil)} replace />
}

function PublicLogin() {
  const { loading, user, profile } = useAuth()
  if (loading) return <Waiting />
  if (user && profile?.troca_senha_pendente) return <Navigate to="/trocar-senha" replace />
  if (user) return <Navigate to="/" replace />
  return <Login />
}

function ProtectedPassword() {
  const { loading, user, profile, error, refresh, signOut } = useAuth()
  if (loading) return <Waiting />
  if (!user) return <Navigate to="/login" replace />
  if (error || !profile) return <StateMessage title="Perfil indisponível" detail={error || 'Esta conta ainda não possui perfil autorizado.'} action={refresh} actionLabel="Recarregar perfil" />
  if (!profile.ativo || !profile.empresa_ativa) return <StateMessage title="Acesso desativado" detail="Solicite ajuda ao Administrador geral." action={signOut} actionLabel="Sair" />
  if (!profile.troca_senha_pendente) return <Navigate to={defaultRouteFor(profile.perfil)} replace />
  return <PasswordChange forced />
}

function AccessState() {
  const { loading, user, profile, error, refresh, signOut } = useAuth()
  if (loading) return <Waiting />
  if (!user) return <Navigate to="/login" replace />
  if (profile?.ativo && profile?.empresa_ativa && !error) return <Navigate to="/" replace />
  return <StateMessage title="Acesso não liberado" detail={error || 'Seu perfil não foi encontrado ou está inativo. Consulte o Administrador geral.'} action={error ? refresh : signOut} actionLabel={error ? 'Tentar novamente' : 'Sair'} />
}

export default function App() {
  if (configurationProblem) {
    return <StateMessage icon={Settings2} title="Configuração inicial necessária" detail="Copie .env.example para .env, preencha a URL e a chave publicável do Supabase e reinicie o Vite. Nunca use service_role no navegador." />
  }

  return <Routes>
    <Route path="/login" element={<PublicLogin />} />
    <Route path="/esqueci-senha" element={<RequestRecovery />} />
    <Route path="/recuperar-senha" element={<PasswordChange recovery />} />
    <Route path="/trocar-senha" element={<ProtectedPassword />} />
    <Route path="/acesso" element={<AccessState />} />
    <Route path="/" element={<RootRedirect />} />
    <Route element={<Guard />}>
      <Route element={<Shell />}>
        <Route path="/dashboard" element={<AllowRoles allowed={['ADMIN_GERAL', 'DESBLOQUEIO']}><DashboardReal /></AllowRoles>} />
        <Route path="/central" element={<CentralReal />} />
        <Route path="/novo-agendamento" element={<AllowRoles allowed={['ADMIN_GERAL', 'ADMIN_EMPRESA', 'PARCEIRO']}><NovoAgendamento /></AllowRoles>} />
        <Route path="/empresas" element={<AllowRoles allowed={['ADMIN_GERAL']}><EmpresasAdmin /></AllowRoles>} />
        <Route path="/usuarios" element={<AllowRoles allowed={['ADMIN_GERAL', 'ADMIN_EMPRESA']}><UsuariosAdmin /></AllowRoles>} />
        <Route path="/status" element={<AllowRoles allowed={['ADMIN_GERAL']}><GerenciarStatus /></AllowRoles>} />
        <Route path="/backup" element={<AllowRoles allowed={['ADMIN_GERAL']}><BackupSistema /></AllowRoles>} />
        <Route path="/minha-conta" element={<MyAccount />} />
        <Route path="/alterar-senha" element={<PasswordChange />} />
        <Route path="/notificacoes" element={<AllowRoles allowed={['ADMIN_EMPRESA', 'DESBLOQUEIO']}><NotificacoesInternas /></AllowRoles>} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
