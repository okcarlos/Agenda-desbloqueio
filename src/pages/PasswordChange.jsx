import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { defaultRouteFor, useAuth } from '../auth/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

export function PasswordChange({ forced = false, recovery = false }) {
  const navigate = useNavigate()
  const { user, profile, refresh } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    if (password.length < 12) { setError('Use uma senha com pelo menos 12 caracteres.'); return }
    if (password !== confirm) { setError('As senhas informadas não são iguais.'); return }
    setError('')
    setBusy(true)
    try {
      const { error: authError } = await supabase.auth.updateUser({ password })
      if (authError) throw authError
      // O gatilho SQL do Auth libera a troca provisória SOMENTE quando o hash da senha muda.
      await refresh()
      setSuccess(true)
      setPassword('')
      setConfirm('')
    } catch { setError('A senha não pôde ser alterada. Verifique as regras de senha e tente novamente.') }
    finally { setBusy(false) }
  }

  const title = forced ? 'Defina sua senha definitiva' : recovery ? 'Redefina sua senha' : 'Alterar senha'
  const subtitle = forced
    ? 'Por segurança, a senha provisória deve ser substituída antes de usar o sistema.'
    : 'Defina uma senha exclusiva com, no mínimo, 12 caracteres.'

  return <div className="password-layout"><div className="password-card">
    <div className="password-icon"><KeyRound size={26} /></div>
    <span className="auth-kicker">SEGURANÇA DE ACESSO</span>
    <h1>{title}</h1><p>{subtitle}</p>
    {recovery && !user && <div className="inline-info">Abra esta página pelo link de recuperação recebido por e-mail. Se o link expirou, <Link to="/esqueci-senha">solicite outro</Link>.</div>}
    {success ? <div className="auth-message"><ShieldCheck size={26} /><h3>Senha atualizada</h3><p>Você já pode prosseguir para o sistema.</p><button className="btn primary" type="button" onClick={() => navigate(profile ? defaultRouteFor(profile.perfil) : '/login', { replace: true })}>Continuar <ArrowRight size={17} /></button></div> : <form className="auth-form" onSubmit={submit}>
      <label htmlFor="password-new">Nova senha</label><div className="field-with-icon"><LockKeyhole size={19} /><input id="password-new" type="password" autoComplete="new-password" minLength={12} value={password} onChange={event => setPassword(event.target.value)} required /></div>
      <label htmlFor="password-confirm">Confirme a nova senha</label><div className="field-with-icon"><LockKeyhole size={19} /><input id="password-confirm" type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={event => setConfirm(event.target.value)} required /></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="btn primary auth-submit" disabled={busy || (recovery && !user)} type="submit">{busy ? 'Salvando...' : 'Salvar nova senha'}<ArrowRight size={18} /></button>
    </form>}
    {!forced && !success && <Link className="auth-back" to={recovery ? '/login' : '/minha-conta'}>Voltar</Link>}
  </div></div>
}
