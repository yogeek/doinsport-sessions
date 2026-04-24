import { addDays, eachDayOfInterval, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function plusDaysIso(days: number): string {
  return format(addDays(new Date(), days), 'yyyy-MM-dd')
}

export function daysBetween(startIso: string, endIso: string): string[] {
  const start = parseISO(startIso)
  const end = parseISO(endIso)
  if (end < start) return []
  return eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'))
}

export function formatDayLong(dateIso: string): string {
  return format(parseISO(dateIso), 'EEEE d MMMM', { locale: fr })
}

export function formatDayShort(dateIso: string): string {
  return format(parseISO(dateIso), 'd MMM', { locale: fr })
}

// Convertit "HH:mm" en minutes depuis minuit (pour tri/comparaison)
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

// Ajoute ":00" à "HH:mm" pour l'API qui attend "HH:mm:ss"
export function toApiTime(hhmm: string): string {
  return hhmm.length === 5 ? `${hhmm}:00` : hhmm
}
