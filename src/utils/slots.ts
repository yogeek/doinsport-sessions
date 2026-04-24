import type { Playground, Slot, AggregatedSlot } from '../types'
import { timeToMinutes } from './date'

interface SlotsByPlayground {
  playground: Playground
  date: string
  slots: Slot[]
}

function isSlotFree(slot: Slot): boolean {
  // Un créneau est disponible si participantsCount < maxParticipantsCountLimit
  // Pour les terrains "unique booking", on vérifie aussi bookingsCount
  const hasRoom = slot.participantsCount < slot.maxParticipantsCountLimit
  const underBookingLimit = slot.bookingsCount < (slot.maxBookingsCountLimit || 1)
  return hasRoom && underBookingLimit
}

function inTimeWindow(slot: Slot, fromHHmm: string, toHHmm: string): boolean {
  const slotStart = timeToMinutes(slot.startAt)
  const slotEnd = timeToMinutes(slot.endAt)
  const windowStart = timeToMinutes(fromHHmm)
  const windowEnd = timeToMinutes(toHHmm)
  return slotStart >= windowStart && slotEnd <= windowEnd
}

/**
 * Agrège des slots venant de plusieurs terrains en créneaux unifiés (date, startAt, endAt).
 * Retourne uniquement les créneaux où le nombre de terrains libres >= minFreeCourts.
 */
export function aggregateSlots(
  datasets: SlotsByPlayground[],
  options: {
    fromHHmm: string
    toHHmm: string
    minFreeCourts: number
  }
): AggregatedSlot[] {
  // Clé = "date|startAt|endAt"
  const grouped = new Map<
    string,
    { date: string; startAt: string; endAt: string; free: Playground[]; booked: Playground[] }
  >()

  for (const { playground, date, slots } of datasets) {
    for (const slot of slots) {
      if (!inTimeWindow(slot, options.fromHHmm, options.toHHmm)) continue

      const key = `${date}|${slot.startAt}|${slot.endAt}`
      let entry = grouped.get(key)
      if (!entry) {
        entry = {
          date,
          startAt: slot.startAt,
          endAt: slot.endAt,
          free: [],
          booked: []
        }
        grouped.set(key, entry)
      }
      if (isSlotFree(slot)) {
        entry.free.push(playground)
      } else {
        entry.booked.push(playground)
      }
    }
  }

  const result: AggregatedSlot[] = []
  for (const entry of grouped.values()) {
    if (entry.free.length < options.minFreeCourts) continue
    result.push({
      date: entry.date,
      startAt: entry.startAt,
      endAt: entry.endAt,
      freeCourts: entry.free,
      bookedCourts: entry.booked
    })
  }

  // Tri : par date puis par heure de début
  result.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return timeToMinutes(a.startAt) - timeToMinutes(b.startAt)
  })

  return result
}

/** Groupe les créneaux agrégés par date pour un affichage ergonomique */
export function groupByDate(slots: AggregatedSlot[]): Array<{ date: string; slots: AggregatedSlot[] }> {
  const map = new Map<string, AggregatedSlot[]>()
  for (const s of slots) {
    const list = map.get(s.date) ?? []
    list.push(s)
    map.set(s.date, list)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, slots]) => ({ date, slots }))
}
