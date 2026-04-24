import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  Clock,
  LogOut,
  Search,
  Loader2,
  Users,
  CheckCircle2,
  MapPin,
  ChevronDown,
  ChevronUp,
  Building2
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchPlaygrounds,
  fetchSlots,
  mapWithConcurrency,
  ApiError,
  extractClubId,
  deduceClubsFromPlaygrounds
} from '../api/doinsport'
import type { Playground, AggregatedSlot, Club } from '../types'
import { daysBetween, formatDayLong, plusDaysIso, todayIso, toApiTime } from '../utils/date'
import { aggregateSlots, groupByDate } from '../utils/slots'

type SessionSize = 1 | 2 | 3

const SESSION_PRESETS: Array<{ value: SessionSize; label: string; sub: string }> = [
  { value: 1, label: '1 terrain', sub: '4 joueurs' },
  { value: 2, label: '2 terrains', sub: '8 joueurs' },
  { value: 3, label: '3 terrains', sub: '12 joueurs' }
]

export default function SearchScreen() {
  const { session, logout } = useAuth()
  if (!session) return null

  // Filtres
  const [startDate, setStartDate] = useState(todayIso())
  const [endDate, setEndDate] = useState(plusDaysIso(6))
  const [fromTime, setFromTime] = useState('17:00')
  const [toTime, setToTime] = useState('22:00')
  const [minCourts, setMinCourts] = useState<SessionSize>(2)

  // État
  const [allPlaygrounds, setAllPlaygrounds] = useState<Playground[] | null>(null)
  const [playgroundsError, setPlaygroundsError] = useState<string | null>(null)
  const [detectedClubs, setDetectedClubs] = useState<Club[]>([])
  const [selectedClubId, setSelectedClubId] = useState<string | null>(
    session.config.clubId ?? null
  )
  const [results, setResults] = useState<AggregatedSlot[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(true)

  // Filtrer les terrains selon le club sélectionné (ou tous si pas de discrimination possible)
  const playgrounds = useMemo<Playground[] | null>(() => {
    if (!allPlaygrounds) return null
    if (!selectedClubId) return allPlaygrounds
    return allPlaygrounds.filter((pg) => extractClubId(pg.club) === selectedClubId)
  }, [allPlaygrounds, selectedClubId])

  // Charger les terrains à l'init
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchPlaygrounds(session.config, session.token)
        if (cancelled) return
        setAllPlaygrounds(list)

        // Détection multi-clubs (uniquement si on n'a pas déjà filtré côté serveur)
        if (!session.config.clubId) {
          const clubs = deduceClubsFromPlaygrounds(list)
          setDetectedClubs(clubs)
          // Si un seul club détecté → auto-sélection
          if (clubs.length === 1) {
            setSelectedClubId(clubs[0].id)
          }
        }
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Erreur de chargement'
        setPlaygroundsError(msg)
        if (e instanceof ApiError && e.status === 401) logout()
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset des résultats si on change de club
  useEffect(() => {
    setResults(null)
  }, [selectedClubId])

  const handleSearch = useCallback(async () => {
    if (!playgrounds || playgrounds.length === 0) return
    setIsSearching(true)
    setSearchError(null)
    setResults(null)

    try {
      const days = daysBetween(startDate, endDate)
      if (days.length === 0) {
        throw new Error('La date de fin doit être après la date de début.')
      }
      if (days.length > 31) {
        throw new Error('Période trop longue (31 jours max).')
      }

      // Construire toutes les combinaisons (playground, date)
      const tasks = playgrounds.flatMap((pg) =>
        days.map((date) => ({ pg, date }))
      )

      // Limiter à 4 requêtes parallèles pour rester sous le rate limit
      const raw = await mapWithConcurrency(tasks, 4, async ({ pg, date }) => {
        const data = await fetchSlots(
          session.config,
          session.token,
          pg.id,
          date,
          toApiTime(fromTime),
          toApiTime(toTime)
        )
        return { playground: pg, date, slots: data.items ?? [] }
      })

      const aggregated = aggregateSlots(raw, {
        fromHHmm: fromTime,
        toHHmm: toTime,
        minFreeCourts: minCourts
      })

      setResults(aggregated)
      setFiltersOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de recherche'
      setSearchError(msg)
      if (e instanceof ApiError && e.status === 401) logout()
    } finally {
      setIsSearching(false)
    }
  }, [playgrounds, startDate, endDate, fromTime, toTime, minCourts, session, logout])

  const grouped = useMemo(() => (results ? groupByDate(results) : []), [results])

  const canSearch =
    !!playgrounds && playgrounds.length > 0 && !isSearching && !!startDate && !!endDate

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-cream-50/80 backdrop-blur border-b border-cream-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-forest-800 flex items-center justify-center text-base flex-shrink-0">
              🎾
            </div>
            <div className="min-w-0">
              <div className="font-display font-semibold text-forest-900 leading-tight truncate">
                Doinsport Sessions
              </div>
              <div className="text-[11px] text-forest-700/60 truncate">
                {session.email}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-forest-700 hover:text-forest-900 px-3 py-2 rounded-lg hover:bg-cream-100 transition"
            aria-label="Déconnexion"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Erreur de chargement des terrains */}
        {playgroundsError && (
          <ErrorBox message={playgroundsError} />
        )}

        {/* État initial des terrains */}
        {!playgrounds && !playgroundsError && (
          <div className="card p-5 flex items-center gap-3 text-forest-700">
            <Loader2 className="animate-spin" size={18} />
            Chargement des terrains du club…
          </div>
        )}

        {playgrounds && playgrounds.length === 0 && selectedClubId && (
          <div className="card p-5 text-forest-700">
            Aucun terrain actif trouvé pour ce club.
          </div>
        )}

        {allPlaygrounds && allPlaygrounds.length === 0 && !playgroundsError && (
          <div className="card p-5 text-forest-700">
            Aucun terrain accessible avec ce compte. Vérifie tes droits ou
            saisis un <code className="font-mono">club.id</code> dans la
            configuration au login.
          </div>
        )}

        {/* Sélecteur de club si plusieurs détectés */}
        {detectedClubs.length > 1 && (
          <section className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={16} className="text-forest-700" />
              <h3 className="font-semibold">Choisir un club</h3>
              <span className="text-xs text-forest-700/60">
                ({detectedClubs.length} clubs détectés)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {detectedClubs.map((club) => {
                const active = selectedClubId === club.id
                const courtCount =
                  allPlaygrounds?.filter((pg) => extractClubId(pg.club) === club.id).length ?? 0
                return (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => setSelectedClubId(club.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? 'border-forest-800 bg-forest-800 text-cream-50'
                        : 'border-cream-200 bg-white hover:border-forest-700'
                    }`}
                  >
                    <div className="font-semibold text-sm truncate">
                      {club.name || `Club ${club.id.slice(0, 8)}`}
                    </div>
                    <div className={`text-xs mt-0.5 ${active ? 'text-cream-100/70' : 'text-forest-700/60'}`}>
                      {courtCount} terrain{courtCount > 1 ? 's' : ''}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Message si plusieurs clubs détectés mais aucun sélectionné */}
        {detectedClubs.length > 1 && !selectedClubId && (
          <div className="text-center py-6 text-forest-700/60 text-sm">
            ↑ Sélectionne un club pour commencer.
          </div>
        )}

        {/* Carte filtres */}
        {playgrounds && playgrounds.length > 0 && (detectedClubs.length <= 1 || selectedClubId) && (
          <section className="card overflow-hidden">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-cream-100/50 transition"
            >
              <div className="flex items-center gap-2.5">
                <Search size={18} className="text-forest-700" />
                <span className="font-semibold">Rechercher un créneau</span>
                {!filtersOpen && results && (
                  <span className="text-xs text-forest-700/60 hidden sm:inline">
                    · {minCourts} court{minCourts > 1 ? 's' : ''} libre{minCourts > 1 ? 's' : ''} min · {fromTime}–{toTime}
                  </span>
                )}
              </div>
              {filtersOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {filtersOpen && (
              <div className="px-5 pb-5 pt-1 space-y-5 border-t border-cream-200">
                {/* Taille de session */}
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Users size={12} />
                    Taille de session
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {SESSION_PRESETS.map((opt) => {
                      const active = minCourts === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setMinCourts(opt.value)}
                          className={`rounded-xl border p-3 text-left transition ${
                            active
                              ? 'border-forest-800 bg-forest-800 text-cream-50'
                              : 'border-cream-200 bg-white hover:border-forest-700'
                          }`}
                        >
                          <div className="font-semibold text-sm">{opt.label}</div>
                          <div className={`text-xs ${active ? 'text-cream-100/70' : 'text-forest-700/60'}`}>
                            {opt.sub}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Période */}
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Calendar size={12} />
                    Période
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[11px] text-forest-700/60 mb-1">Du</div>
                      <input
                        type="date"
                        value={startDate}
                        min={todayIso()}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-forest-700/60 mb-1">Au</div>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>

                {/* Plage horaire */}
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Clock size={12} />
                    Plage horaire
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[11px] text-forest-700/60 mb-1">De</div>
                      <input
                        type="time"
                        value={fromTime}
                        onChange={(e) => setFromTime(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-forest-700/60 mb-1">À</div>
                      <input
                        type="time"
                        value={toTime}
                        onChange={(e) => setToTime(e.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSearch}
                  disabled={!canSearch}
                  className="btn-primary w-full"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Recherche en cours…
                    </>
                  ) : (
                    <>
                      <Search size={18} />
                      Rechercher
                    </>
                  )}
                </button>

                <div className="text-[11px] text-forest-700/60 flex items-center gap-1.5">
                  <MapPin size={11} />
                  {playgrounds.length} terrain{playgrounds.length > 1 ? 's' : ''} actif
                  {playgrounds.length > 1 ? 's' : ''} dans ce club
                </div>
              </div>
            )}
          </section>
        )}

        {/* Erreur de recherche */}
        {searchError && <ErrorBox message={searchError} />}

        {/* Résumé des résultats */}
        {results && !isSearching && (
          <div className="flex items-center gap-2 text-sm text-forest-700/80 px-1">
            <CheckCircle2 size={16} className="text-forest-700" />
            {results.length === 0 ? (
              <span>Aucun créneau trouvé pour ces critères.</span>
            ) : (
              <span>
                <strong className="text-forest-900">{results.length}</strong> créneau
                {results.length > 1 ? 'x' : ''} trouvé{results.length > 1 ? 's' : ''} sur{' '}
                {grouped.length} jour{grouped.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Résultats */}
        {results && grouped.length > 0 && (
          <div className="space-y-6">
            {grouped.map(({ date, slots }) => (
              <DaySection
                key={date}
                date={date}
                slots={slots}
                minCourts={minCourts}
              />
            ))}
          </div>
        )}

        {/* Vide si pas encore recherché */}
        {!results && !searchError && playgrounds && playgrounds.length > 0 && !isSearching && (detectedClubs.length <= 1 || selectedClubId) && (
          <div className="text-center py-12 text-forest-700/50 text-sm">
            Configure tes filtres puis lance une recherche.
          </div>
        )}
      </main>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-clay-500/10 border border-clay-500/30 text-clay-600 px-4 py-3 text-sm flex gap-2">
      <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}

function DaySection({
  date,
  slots,
  minCourts
}: {
  date: string
  slots: AggregatedSlot[]
  minCourts: number
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-forest-700/70 mb-2 px-1">
        {formatDayLong(date)}
      </h3>
      <div className="space-y-2">
        {slots.map((slot) => (
          <SlotCard
            key={`${slot.date}-${slot.startAt}`}
            slot={slot}
            minCourts={minCourts}
          />
        ))}
      </div>
    </section>
  )
}

function SlotCard({ slot, minCourts }: { slot: AggregatedSlot; minCourts: number }) {
  const enoughForBigger = slot.freeCourts.length > minCourts
  const totalCourts = slot.freeCourts.length + slot.bookedCourts.length

  return (
    <article className="card p-4 flex items-center gap-4">
      {/* Heure */}
      <div className="flex-shrink-0 text-center">
        <div className="font-display text-2xl font-semibold text-forest-900 leading-none">
          {slot.startAt}
        </div>
        <div className="text-xs text-forest-700/60 mt-1">→ {slot.endAt}</div>
      </div>

      {/* Barre verticale */}
      <div className="w-px self-stretch bg-cream-200" />

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="font-display text-xl font-semibold text-forest-800">
            {slot.freeCourts.length}
          </span>
          <span className="text-sm text-forest-700/70">
            / {totalCourts} libre{slot.freeCourts.length > 1 ? 's' : ''}
          </span>
          {enoughForBigger && (
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider bg-clay-500/15 text-clay-600 px-2 py-0.5 rounded-full">
              Bonus
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {slot.freeCourts.map((pg) => (
            <span
              key={pg.id}
              className="text-xs font-medium bg-forest-800/5 text-forest-800 px-2 py-1 rounded-md border border-forest-800/10"
            >
              {pg.shortName || pg.name}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}
