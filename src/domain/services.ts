import type { ServiceId } from './types'
import { SERVICE_IDS } from './types'

export interface ServiceInfo {
  readonly id: ServiceId
  readonly name: string
  readonly blurb: string
  readonly examples: string
}

const SERVICE_BY_ID = {
  phone: {
    id: 'phone',
    name: 'Phone and tablet',
    blurb: 'Screens, batteries, charging ports, water damage',
    examples: 'Cracked screen, battery drains fast, will not charge',
  },
  computer: {
    id: 'computer',
    name: 'Laptop and desktop',
    blurb: 'Slow or dead machines, keyboards, upgrades',
    examples: 'Will not boot, overheating, needs a new SSD',
  },
  appliance: {
    id: 'appliance',
    name: 'Home appliance',
    blurb: 'Aircon, refrigerator, washing machine',
    examples: 'Aircon not cooling, washing machine leaks',
  },
  tv_audio: {
    id: 'tv_audio',
    name: 'TV and audio',
    blurb: 'No picture, no sound, remote problems',
    examples: 'Screen goes black, speaker crackles',
  },
  electrical: {
    id: 'electrical',
    name: 'Electrical',
    blurb: 'Outlets, switches, small wiring faults',
    examples: 'Outlet sparks, breaker keeps tripping',
  },
  other: {
    id: 'other',
    name: 'Other repair',
    blurb: 'Anything else you would like checked',
    examples: 'Describe it and the shop will advise',
  },
} satisfies Record<ServiceId, ServiceInfo>

export const SERVICES: readonly ServiceInfo[] = SERVICE_IDS.map((id) => SERVICE_BY_ID[id])

export function getService(id: ServiceId): ServiceInfo {
  return SERVICE_BY_ID[id]
}
