import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const DEFAULT_BASE_URL = 'https://api-principale.doinsport.club'

interface Props {
  presetBaseUrl?: string
  presetClubId?: string
}

export default function LoginScreen({ presetBaseUrl, presetClubId }: Props) {
  const { login, loginError, isLoggingIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [baseUrl, setBaseUrl] = useState(presetBaseUrl || DEFAULT_BASE_URL)
  const [clubId, setClubId] = useState(presetClubId || '')
  const [showAdvanced, setShowAdvanced] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    const config = {
      baseUrl: baseUrl.trim(),
      clubId: clubId.trim() || undefined
    }
    await login(email, password, config)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header visuel */}
      <div className="relative overflow-hidden bg-forest-800 text-cream-50 pb-16 pt-12 px-6">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, #d97748 0%, transparent 50%), radial-gradient(circle at 80% 70%, #faf7f2 0%, transparent 40%)'
          }}
        />
        <div className="relative max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-clay-500 flex items-center justify-center text-xl">
              🎾
            </div>
            <span className="font-medium tracking-wide text-cream-100/80 uppercase text-xs">
              Doinsport Sessions
            </span>
          </div>
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">
            Trouve des créneaux
            <br />
            <span className="text-clay-400 italic">pour jouer ensemble.</span>
          </h1>
          <p className="mt-4 text-cream-100/70 text-sm max-w-sm">
            Démo d'intégration avec l'API Doinsport. Consulte la disponibilité
            des terrains de ton club pour organiser des sessions.
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <div className="flex-1 px-6 -mt-10 pb-12 relative">
        <div className="max-w-md mx-auto">
          <form onSubmit={handleSubmit} className="card p-6 space-y-5">
            <h2 className="text-xl font-semibold">Connexion</h2>

            <div>
              <label htmlFor="email" className="label">Email</label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-700/40"
                  size={18}
                />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10"
                  placeholder="ton.email@club.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">Mot de passe</label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-700/40"
                  size={18}
                />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs font-medium text-forest-700 hover:text-forest-800 transition"
            >
              Configuration {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showAdvanced && (
              <div className="space-y-4 pt-2 border-t border-cream-200">
                <div>
                  <label htmlFor="baseUrl" className="label">URL de base API</label>
                  <input
                    id="baseUrl"
                    type="url"
                    required
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="input-field font-mono text-sm"
                    placeholder="https://api-principale.doinsport.club"
                  />
                  <p className="mt-1 text-xs text-forest-700/60">
                    Adapter selon le tenant du club (ex: allin-api, api-principale…)
                  </p>
                </div>

                <div>
                  <label htmlFor="clubId" className="label">Club ID (optionnel)</label>
                  <input
                    id="clubId"
                    type="text"
                    value={clubId}
                    onChange={(e) => setClubId(e.target.value)}
                    className="input-field font-mono text-sm"
                    placeholder="Laisser vide pour détection auto"
                  />
                  <p className="mt-1 text-xs text-forest-700/60">
                    Si vide, l'app liste tous les terrains accessibles à ton compte
                    et te propose un sélecteur si plusieurs clubs sont détectés.
                  </p>
                </div>
              </div>
            )}

            {loginError && (
              <div className="rounded-xl bg-clay-500/10 border border-clay-500/30 text-clay-600 px-4 py-3 text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn || !email || !password}
              className="btn-primary w-full"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Connexion…
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-forest-700/60">
            Tes identifiants ne sont jamais stockés. Seul le token JWT est gardé
            localement pour la session.
          </p>
        </div>
      </div>
    </div>
  )
}
