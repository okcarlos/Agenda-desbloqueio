import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

// Nunca inserir chaves secretas, service_role ou sb_secret_* em variáveis VITE_*.
export const configurationProblem =
  !url || !key || url.includes('SEU-PROJETO') || key.includes('COLE_A_CHAVE')

export const supabase = configurationProblem
  ? null
  : createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
