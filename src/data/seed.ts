import { newId } from '@/domain/ids'
import { defaultAvailability, dayHours } from '@/domain/availability'
import type { Availability } from '@/domain/availability'
import { startOfDay } from '@/domain/schedule'
import type { AppNotification, HistoryEntry, Quotation, RequestStatus, Role, ServiceRequest, User } from '@/domain/types'
import { clearAllStores, idb, parseRow, runTx } from './db'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './demo'
import { AVAILABILITY_KEY, REQUEST_COUNTER_KEY, SEEDED_KEY } from './meta'
import { hashPassword } from './password'
import { z } from 'zod'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const SeededSchema = z.object({ key: z.string(), value: z.boolean() })

function entry(status: RequestStatus, at: number, by: Role, note = ''): HistoryEntry {
  return { status, at, by, note }
}

/** The demo shop: the default week with a one-hour lunch break, so the owner screen shows a real example. */
function demoAvailability(now: number): Availability {
  return { ...defaultAvailability(now), lunch: { enabled: true, from: 12 * 60, to: 13 * 60 } }
}

/** The next open weekday after `now`, at `hour` local time. */
function nextOpenDayAt(now: number, hour: number): number {
  const availability = demoAvailability(now)
  let day = startOfDay(now) + DAY
  for (let guard = 0; guard < 7; guard += 1) {
    const date = new Date(day)
    if (dayHours(availability, date.getDay())?.open === true) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour).getTime()
    }
    day = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
  }
  return startOfDay(now) + DAY + hour * HOUR
}

function atHour(timestamp: number, hour: number): number {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour).getTime()
}

function quotation(
  items: readonly { description: string; quantity: number; unitPriceCentavos: number }[],
  notes: string,
  estimatedDays: number,
  sentAt: number,
  validDays: number,
  response: Quotation['response'],
  respondedAt: number | null,
): Quotation {
  return {
    items: items.map((item) => ({ ...item, id: newId() })),
    notes,
    estimatedDays,
    validUntil: sentAt + validDays * DAY,
    totalCentavos: items.reduce((sum, item) => sum + item.quantity * item.unitPriceCentavos, 0),
    sentAt,
    response,
    respondedAt,
  }
}

interface SeedData {
  readonly users: User[]
  readonly requests: ServiceRequest[]
  readonly notifications: AppNotification[]
  readonly availability: Availability
}

async function buildSeed(now: number): Promise<SeedData> {
  // One hash per account. Hashing is slow, so it happens before any transaction opens.
  const makeUser = async (role: Role, account: { name: string; email: string; phone: string }): Promise<User> => ({
    id: newId(),
    role,
    name: account.name,
    email: account.email,
    phone: account.phone,
    ...(await hashPassword(DEMO_PASSWORD)),
    createdAt: now - 30 * DAY,
  })
  const [owner, ana, ben] = await Promise.all([
    makeUser('owner', DEMO_ACCOUNTS.owner),
    makeUser('customer', DEMO_ACCOUNTS.customer),
    makeUser('customer', DEMO_ACCOUNTS.secondCustomer),
  ])

  const phoneCreated = now - 3 * HOUR
  const laptopCreated = now - 1 * DAY
  const acCreated = now - 6 * DAY
  const tvCreated = now - 12 * DAY
  const washerCreated = now - 4 * DAY

  const laptopQuote = quotation(
    [
      { description: '512 GB SSD', quantity: 1, unitPriceCentavos: 280_000 },
      { description: 'Windows install and data transfer', quantity: 1, unitPriceCentavos: 50_000 },
    ],
    'Your files are backed up before the upgrade.',
    1,
    laptopCreated + 5 * HOUR,
    6,
    null,
    null,
  )
  const acQuote = quotation(
    [
      { description: 'Refrigerant recharge', quantity: 1, unitPriceCentavos: 180_000 },
      { description: 'Indoor and outdoor unit cleaning', quantity: 1, unitPriceCentavos: 120_000 },
    ],
    'Includes a 30-day warranty on the service.',
    1,
    acCreated + 1 * DAY,
    7,
    'accepted',
    acCreated + 1 * DAY + 3 * HOUR,
  )
  const tvQuote = quotation(
    [{ description: 'Backlight strip replacement', quantity: 1, unitPriceCentavos: 420_000 }],
    '',
    3,
    tvCreated + 1 * DAY,
    7,
    'accepted',
    tvCreated + 1 * DAY + 2 * HOUR,
  )
  const washerQuote = quotation(
    [
      { description: 'Drain pump', quantity: 1, unitPriceCentavos: 150_000 },
      { description: 'Labor', quantity: 1, unitPriceCentavos: 60_000 },
    ],
    'Home visit included in the labor charge.',
    1,
    washerCreated + 1 * DAY,
    7,
    'accepted',
    washerCreated + 1 * DAY + 2 * HOUR,
  )

  const acAppointment = atHour(now - 2 * DAY, 10)
  const tvAppointment = atHour(now - 9 * DAY, 14)
  const washerAppointment = nextOpenDayAt(now, 10)

  const requests: ServiceRequest[] = [
    {
      id: newId(),
      ref: 'FF-0001',
      customerId: ana.id,
      serviceId: 'phone',
      itemName: 'Samsung Galaxy A54',
      description: 'The screen has a crack across the top and the touch is slow near the edge.',
      mode: 'drop_off',
      address: '',
      imageIds: [],
      status: 'requested',
      quotation: null,
      appointment: null,
      feedback: null,
      closure: null,
      history: [entry('requested', phoneCreated, 'customer')],
      createdAt: phoneCreated,
      updatedAt: phoneCreated,
    },
    {
      id: newId(),
      ref: 'FF-0002',
      customerId: ana.id,
      serviceId: 'computer',
      itemName: 'Lenovo IdeaPad 3',
      description: 'The laptop takes about ten minutes to start and freezes when I open more than two tabs.',
      mode: 'drop_off',
      address: '',
      imageIds: [],
      status: 'quotation_sent',
      quotation: laptopQuote,
      appointment: null,
      feedback: null,
      closure: null,
      history: [
        entry('requested', laptopCreated, 'customer'),
        entry('under_review', laptopCreated + 2 * HOUR, 'owner'),
        entry('quotation_sent', laptopCreated + 5 * HOUR, 'owner'),
      ],
      createdAt: laptopCreated,
      updatedAt: laptopCreated + 5 * HOUR,
    },
    {
      id: newId(),
      ref: 'FF-0003',
      customerId: ana.id,
      serviceId: 'appliance',
      itemName: 'Split-type aircon',
      description: 'The aircon runs but the room does not get cold, and there is water dripping from the indoor unit.',
      mode: 'home_visit',
      address: '14 Rizal Street',
      imageIds: [],
      status: 'completed',
      quotation: acQuote,
      appointment: { startAt: acAppointment, durationMinutes: 60, createdBy: 'customer', updatedAt: acCreated + 1 * DAY + 4 * HOUR },
      feedback: null,
      closure: null,
      history: [
        entry('requested', acCreated, 'customer'),
        entry('under_review', acCreated + 3 * HOUR, 'owner'),
        entry('quotation_sent', acCreated + 1 * DAY, 'owner'),
        entry('quotation_accepted', acCreated + 1 * DAY + 3 * HOUR, 'customer'),
        entry('scheduled', acCreated + 1 * DAY + 4 * HOUR, 'customer'),
        entry('in_progress', acAppointment, 'owner'),
        entry('completed', acAppointment + 3 * HOUR, 'owner'),
      ],
      createdAt: acCreated,
      updatedAt: acAppointment + 3 * HOUR,
    },
    {
      id: newId(),
      ref: 'FF-0004',
      customerId: ben.id,
      serviceId: 'tv_audio',
      itemName: 'Samsung 43 inch TV',
      description: 'There is sound but the screen stays dark. A flashlight shows a faint picture.',
      mode: 'drop_off',
      address: '',
      imageIds: [],
      status: 'feedback',
      quotation: tvQuote,
      appointment: { startAt: tvAppointment, durationMinutes: 60, createdBy: 'customer', updatedAt: tvCreated + 1 * DAY + 3 * HOUR },
      feedback: { rating: 4, comment: 'Picture is bright again. Pickup took a little longer than promised.', createdAt: now - 6 * DAY },
      closure: null,
      history: [
        entry('requested', tvCreated, 'customer'),
        entry('under_review', tvCreated + 2 * HOUR, 'owner'),
        entry('quotation_sent', tvCreated + 1 * DAY, 'owner'),
        entry('quotation_accepted', tvCreated + 1 * DAY + 2 * HOUR, 'customer'),
        entry('scheduled', tvCreated + 1 * DAY + 3 * HOUR, 'customer'),
        entry('in_progress', tvAppointment, 'owner'),
        entry('completed', tvAppointment + 5 * HOUR, 'owner'),
        entry('feedback', now - 6 * DAY, 'customer'),
      ],
      createdAt: tvCreated,
      updatedAt: now - 6 * DAY,
    },
    {
      id: newId(),
      ref: 'FF-0005',
      customerId: ben.id,
      serviceId: 'appliance',
      itemName: 'Top-load washing machine',
      description: 'The machine fills with water but will not drain, and it stops mid-cycle.',
      mode: 'home_visit',
      address: '82 Mabini Avenue',
      imageIds: [],
      status: 'scheduled',
      quotation: washerQuote,
      appointment: { startAt: washerAppointment, durationMinutes: 60, createdBy: 'customer', updatedAt: washerCreated + 1 * DAY + 4 * HOUR },
      feedback: null,
      closure: null,
      history: [
        entry('requested', washerCreated, 'customer'),
        entry('under_review', washerCreated + 2 * HOUR, 'owner'),
        entry('quotation_sent', washerCreated + 1 * DAY, 'owner'),
        entry('quotation_accepted', washerCreated + 1 * DAY + 2 * HOUR, 'customer'),
        entry('scheduled', washerCreated + 1 * DAY + 4 * HOUR, 'customer'),
      ],
      createdAt: washerCreated,
      updatedAt: washerCreated + 1 * DAY + 4 * HOUR,
    },
  ]

  const refToId = new Map(requests.map((request) => [request.ref, request.id]))
  const requestId = (ref: string): string => refToId.get(ref) ?? ''
  const note = (
    userId: string,
    ref: string,
    title: string,
    body: string,
    createdAt: number,
    read: boolean,
  ): AppNotification => ({
    id: newId(),
    userId,
    requestId: requestId(ref),
    title,
    body,
    createdAt,
    readAt: read ? createdAt + HOUR : null,
  })

  const notifications: AppNotification[] = [
    note(owner.id, 'FF-0001', 'New service request', 'FF-0001: Ana Reyes submitted a request for Samsung Galaxy A54.', phoneCreated, false),
    note(owner.id, 'FF-0004', 'New feedback', 'FF-0004: 4 out of 5 stars for Samsung 43 inch TV.', now - 6 * DAY, true),
    note(ana.id, 'FF-0002', 'Your quotation is ready', 'FF-0002: review the quotation for your Lenovo IdeaPad 3.', laptopCreated + 5 * HOUR, false),
    note(ana.id, 'FF-0003', 'Repair completed', 'FF-0003: your Split-type aircon is done. Tell us how it went.', acAppointment + 3 * HOUR, false),
  ]

  return { users: [owner, ana, ben], requests, notifications, availability: demoAvailability(now) }
}

async function writeSeed(data: SeedData): Promise<void> {
  await runTx(['users', 'requests', 'notifications', 'meta'], 'readwrite', async (tx) => {
    const users = tx.objectStore('users')
    const requests = tx.objectStore('requests')
    const notifications = tx.objectStore('notifications')
    const meta = tx.objectStore('meta')
    await Promise.all([
      ...data.users.map((user) => idb(users.put(user))),
      ...data.requests.map((request) => idb(requests.put(request))),
      ...data.notifications.map((item) => idb(notifications.put(item))),
      idb(meta.put({ key: REQUEST_COUNTER_KEY, value: data.requests.length })),
      idb(meta.put({ key: AVAILABILITY_KEY, value: data.availability })),
      idb(meta.put({ key: SEEDED_KEY, value: true })),
    ])
  })
}

/** Creates the demo accounts and sample requests the first time the app opens on a device. */
export async function seedIfEmpty(now: number = Date.now()): Promise<void> {
  const already = await runTx(['meta'], 'readonly', async (tx) => {
    const row: unknown = await idb(tx.objectStore('meta').get(SEEDED_KEY))
    return row === undefined ? false : parseRow(SeededSchema, row, 'seed flag').value
  })
  if (already) return
  await writeSeed(await buildSeed(now))
}

/** Wipes everything on this device and restores the demo data. */
export async function resetDemoData(now: number = Date.now()): Promise<void> {
  const data = await buildSeed(now)
  await clearAllStores()
  await writeSeed(data)
}
