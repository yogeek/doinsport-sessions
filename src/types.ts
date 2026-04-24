// Types basés sur la documentation Doinsport

export interface LoginResponse {
  token: string
  refresh_token?: string
}

// Le champ "club" d'un playground peut être :
// - un IRI string : "/clubs/abc123"
// - un objet hydraté : { id, name, ... }
// - absent (selon la sérialisation API Platform)
export type ClubReference = string | { '@id'?: string; id?: string; name?: string } | null | undefined

export interface Playground {
  '@id': string
  '@type': string
  id: string
  name: string
  shortName?: string
  description?: string
  indoor?: boolean
  enlightened?: boolean
  enabled?: boolean
  bookingType?: 'unique' | 'multiple'
  position?: number
  club?: ClubReference
}

export interface Club {
  id: string
  name?: string
}

export interface Slot {
  block: string
  startAt: string // "HH:mm"
  endAt: string // "HH:mm"
  maxParticipantsCountLimit: number
  bookingsCount: number
  participantsCount: number
  paymentMethods?: string[]
  paymentProviders?: string[]
  maxBookingsCountLimit: number
}

export interface HydraCollection<T> {
  'hydra:member': T[]
  'hydra:totalItems'?: number
}

export interface SlotsResponse {
  totalItems: number
  items: Slot[]
}

// Modèle applicatif : un créneau agrégé sur plusieurs terrains
export interface AggregatedSlot {
  date: string // "yyyy-MM-dd"
  startAt: string // "HH:mm"
  endAt: string // "HH:mm"
  freeCourts: Playground[] // terrains libres sur ce créneau
  bookedCourts: Playground[] // terrains occupés/complets
}

export interface ApiConfig {
  baseUrl: string
  /** Optionnel : si absent, on liste tous les terrains accessibles et on déduit les clubs */
  clubId?: string
}

export interface Session {
  token: string
  email: string
  config: ApiConfig
  issuedAt: number
}
