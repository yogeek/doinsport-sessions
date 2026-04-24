import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { Session, ApiConfig } from '../types'
import { login as apiLogin } from '../api/doinsport'

interface AuthContextValue {
  session: Session | null
  loginError: string | null
  isLoggingIn: boolean
  login: (email: string, password: string, config: ApiConfig) => Promise<boolean>
  logout: () => void
}

const STORAGE_KEY = 'doinsport-session-v1'

const AuthContext = createContext<AuthContextValue | null>(null)

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    // Le token JWT Doinsport dure 1 an, mais on expire au bout de 30 jours par prudence
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000
    if (Date.now() - parsed.issuedAt > maxAgeMs) return null
    return parsed
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession())
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [session])

  const login = useCallback(
    async (email: string, password: string, config: ApiConfig): Promise<boolean> => {
      setIsLoggingIn(true)
      setLoginError(null)
      try {
        const { token } = await apiLogin(config.baseUrl, email, password)
        setSession({ token, email, config, issuedAt: Date.now() })
        return true
      } catch (e) {
        setLoginError(e instanceof Error ? e.message : 'Échec de connexion')
        return false
      } finally {
        setIsLoggingIn(false)
      }
    },
    []
  )

  const logout = useCallback(() => {
    setSession(null)
    setLoginError(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ session, loginError, isLoggingIn, login, logout }),
    [session, loginError, isLoggingIn, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider')
  return ctx
}
