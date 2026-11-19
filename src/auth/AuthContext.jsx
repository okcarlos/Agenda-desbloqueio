import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { configurationProblem, supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)
const emptyAuth = { loading: false, user: null, profile: null, error: null }

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ ...emptyAuth, loading: !configurationProblem })
  const requestCounter = useRef(0)

  const refresh = useCallback(async () => {
    if (!supabase) return
    const requestId = ++requestCounter.current

    try {
      const { data, error: userError } = await supabase.auth.getUser()
      if (requestId !== requestCounter.current) return
      if (userError) {
        // Um token inválido deve resultar em nova autenticação, não em acesso operacional.
        setAuth({ ...emptyAuth, error: 'Não foi possível validar a sessão. Tente entrar novamente.' })
        return
      }
      if (!data?.user) {
        setAuth(emptyAuth)
        return
      }

      // RPC sem argumentos: o banco identifica o usuário por auth.uid().
      const { data: profile, error: profileError } = await supabase.rpc('meu_perfil').single()
      if (requestId !== requestCounter.current) return
      setAuth({
        loading: false,
        user: data.user,
        profile: profileError ? null : profile,
        error: profileError ? 'Falha ao consultar seu perfil. Verifique se a migração SQL foi aplicada.' : null,
      })
    } catch {
      if (requestId === requestCounter.current) {
        setAuth({ ...emptyAuth, error: 'Falha de conexão ao validar a sessão.' })
      }
    }
  }, [])

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        ++requestCounter.current
        setAuth(emptyAuth)
        return
      }
      // Não chamar métodos assíncronos de Auth dentro do callback do evento.
      if (['SIGNED_IN', 'USER_UPDATED', 'PASSWORD_RECOVERY', 'TOKEN_REFRESHED'].includes(event)) {
        setTimeout(() => { if (active) void refresh() }, 0)
      }
    })

    void refresh()
    // A interface valida periodicamente a conta; as operações futuras precisam
    // revalidar permissões em cada RPC SQL, independentemente deste intervalo.
    const interval = setInterval(() => { if (active) void refresh() }, 60_000)
    const onFocus = () => { if (active) void refresh() }
    window.addEventListener('focus', onFocus)

    return () => {
      active = false
      ++requestCounter.current
      subscription.unsubscribe()
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await refresh()
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    ++requestCounter.current
    setAuth(emptyAuth)
  }

  return (
    <AuthContext.Provider value={{ ...auth, refresh, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth exige AuthProvider')
  return auth
}

export function defaultRouteFor(perfil) {
  return perfil === 'ADMIN_GERAL' || perfil === 'DESBLOQUEIO' ? '/dashboard' : '/central'
}

export const perfilLabel = {
  ADMIN_GERAL: 'Administrador geral',
  ADMIN_EMPRESA: 'Administrador da empresa',
  PARCEIRO: 'Parceiro',
  DESBLOQUEIO: 'Desbloqueio',
}
