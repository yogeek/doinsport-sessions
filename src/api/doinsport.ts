import type {
  LoginResponse,
  Playground,
  HydraCollection,
  SlotsResponse,
  ApiConfig,
  ClubReference,
  Club
} from '../types'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${normalizeBaseUrl(baseUrl)}${path}`
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new ApiError(
      0,
      'Network Error',
      `Impossible de contacter l'API (${msg}). Vérifie l'URL et le CORS.`
    )
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.text()
      detail = body.slice(0, 200)
    } catch {
      // ignore
    }
    const base = `${response.status} ${response.statusText}`
    const message =
      response.status === 401
        ? 'Identifiants invalides ou session expirée.'
        : response.status === 429
          ? 'Trop de requêtes, réessaie dans une minute.'
          : `Erreur API (${base}). ${detail}`
    throw new ApiError(response.status, response.statusText, message)
  }

  // Certaines réponses peuvent être vides
  const text = await response.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

export async function login(
  baseUrl: string,
  email: string,
  password: string
): Promise<LoginResponse> {
  return request<LoginResponse>(baseUrl, '/api/login_check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password })
  })
}

export async function fetchPlaygrounds(
  config: ApiConfig,
  token: string
): Promise<Playground[]> {
  const params = new URLSearchParams({
    enabled: 'true',
    itemsPerPage: '100'
  })
  // Filtre côté serveur uniquement si on connaît le club
  if (config.clubId) {
    params.set('club.id', config.clubId)
  }
  const data = await request<HydraCollection<Playground>>(
    config.baseUrl,
    `/clubs/playgrounds?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  )
  const list = data['hydra:member'] ?? []
  return [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}

/**
 * Extrait l'ID du club depuis le champ "club" d'un playground.
 * Le champ peut être un IRI string "/clubs/abc123" ou un objet hydraté.
 */
export function extractClubId(ref: ClubReference): string | null {
  if (!ref) return null
  if (typeof ref === 'string') {
    // "/clubs/abc123" -> "abc123"
    const match = ref.match(/\/clubs\/([^/]+)/)
    return match ? match[1] : ref
  }
  if (typeof ref === 'object') {
    if (ref.id) return ref.id
    if (ref['@id']) {
      const match = ref['@id'].match(/\/clubs\/([^/]+)/)
      return match ? match[1] : null
    }
  }
  return null
}

function extractClubName(ref: ClubReference): string | undefined {
  if (ref && typeof ref === 'object' && ref.name) return ref.name
  return undefined
}

/**
 * Déduit la liste des clubs distincts à partir d'une liste de terrains.
 * Retourne [] si on ne peut extraire aucune info de club (champ absent dans la réponse).
 */
export function deduceClubsFromPlaygrounds(playgrounds: Playground[]): Club[] {
  const map = new Map<string, Club>()
  for (const pg of playgrounds) {
    const id = extractClubId(pg.club)
    if (!id) continue
    const existing = map.get(id)
    const name = extractClubName(pg.club)
    if (!existing) {
      map.set(id, { id, name })
    } else if (!existing.name && name) {
      existing.name = name
    }
  }
  return Array.from(map.values())
}

export async function fetchSlots(
  config: ApiConfig,
  token: string,
  playgroundId: string,
  date: string, // "yyyy-MM-dd"
  from = '06:00:00',
  to = '23:59:59'
): Promise<SlotsResponse> {
  const params = new URLSearchParams({ date, from, to })
  return request<SlotsResponse>(
    config.baseUrl,
    `/clubs/playgrounds/${playgroundId}/slots?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  )
}

// Limite le nombre de requêtes parallèles pour éviter le rate limiting
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}
