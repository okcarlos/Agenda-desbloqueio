import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, CalendarCheck2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../auth/AuthContext.jsx'

function AuthLayout({ children, intro = 'Acesse seu ambiente de trabalho.' }) {
  return <div className="auth-layout">
    <section className="auth-hero">
      <Link to="/login" className="auth-hero-brand"><span className="brand-symbol large">IEV</span><div><strong>IEV Avança</strong><small>Central de Desbloqueios</small></div></Link>
      <div className="auth-hero-copy"><span className="hero-pill"><span className="hero-pill-dot" /> PLATAFORMA OPERACIONAL</span>
        <h1>Conexões que <span>impulsionam</span> resultados.</h1>
        <p>Agendamentos, tratativas e acompanhamento reunidos em uma plataforma segura e organizada.</p>
        <div className="hero-trust"><ShieldCheck size={20} /><span>Acesso exclusivo para usuários autorizados</span></div>
      </div>
      <div className="auth-hero-bottom"><CalendarCheck2 size={19} /> Sistema IEV Avança</div>
    </section>
    <main className="auth-form-area"><div className="auth-form-shell"><div className="auth-mobile-logo"><span className="brand-symbol">IEV</span><strong>IEV Avança</strong></div><span className="auth-kicker">BEM-VINDO AO IEV AVANÇA</span><h2>{intro}</h2>{children}</div></main>
  </div>
}

export function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await signIn(email.trim(), password)
      navigate('/', { replace: true })
    } catch {
      // Evitar dar pistas sobre quais e-mails existem no sistema.
      setError('Não foi possível entrar. Verifique seus dados e tente novamente.')
    } finally { setBusy(false) }
  }

  return <AuthLayout intro="Entre na sua conta.">
    <p className="auth-subtitle">Use as credenciais fornecidas pela administração.</p>
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="login-email">E-mail</label>
      <div className="field-with-icon"><Mail size={19} /><input id="login-email" type="email" placeholder="seu.email@empresa.com" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></div>
      <div className="form-label-row"><label htmlFor="login-password">Senha</label><Link to="/esqueci-senha">Esqueceu a senha?</Link></div>
      <div className="field-with-icon"><LockKeyhole size={19} /><input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="Digite sua senha" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
        <button type="button" className="password-toggle" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="btn primary auth-submit">{busy ? 'Validando...' : 'Entrar no sistema'}<ArrowRight size={18} /></button>
    </form>
    <p className="auth-footnote"><ShieldCheck size={16} /> Ambiente restrito. Não há cadastro público.</p>
  </AuthLayout>
}

export function RequestRecovery() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/recuperar-senha`,
      })
      if (authError) throw authError
      setSubmitted(true)
    } catch { setError('Não foi possível solicitar a recuperação neste momento. Tente novamente.') }
    finally { setBusy(false) }
  }
  return <AuthLayout intro="Recuperar acesso.">
    {submitted ? <div className="auth-message"><h3>Confira seu e-mail</h3><p>Se houver uma conta elegível, você receberá um link para criar uma nova senha. Verifique também a pasta de spam.</p><Link to="/login" className="btn secondary">Voltar ao login</Link></div> : <>
      <p className="auth-subtitle">Informe o e-mail de sua conta. O envio depende da configuração de e-mails do Supabase.</p>
      <form className="auth-form" onSubmit={submit}><label htmlFor="recovery-email">E-mail</label><div className="field-with-icon"><Mail size={19} /><input id="recovery-email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="seu.email@empresa.com" /></div>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <button disabled={busy} className="btn primary auth-submit" type="submit">{busy ? 'Enviando...' : 'Solicitar recuperação'}<ArrowRight size={18} /></button>
      </form><Link to="/login" className="auth-back">Voltar ao login</Link>
    </>}
  </AuthLayout>
}
