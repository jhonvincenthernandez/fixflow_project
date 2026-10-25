import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { dataConfig } from '../src/data/config'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../src/data/demo'
import { clearAllStores, idb, runTx } from '../src/data/db'
import {
  authenticate,
  createRequest,
  getRequest,
  getAvailability,
  getRequestImages,
  getScheduleContext,
  listCustomers,
  listNotifications,
  listRequests,
  markAllNotificationsRead,
  markNotificationRead,
  performAction,
  registerCustomer,
  saveAvailability,
} from '../src/data/repo'
import { resetDemoData, seedIfEmpty } from '../src/data/seed'
import { AVAILABILITY_KEY } from '../src/data/meta'
import { defaultAvailability } from '../src/domain/availability'
import type { AvailabilityInput } from '../src/domain/availability'
import { AuthError, ConflictError, ForbiddenError, NotFoundError, StorageError, ValidationError } from '../src/domain/errors'
import type { Actor } from '../src/domain/workflow'
import { DRAFT, NOW, at, atMinute, makeAvailability, withDay } from './helpers'

beforeAll(() => {
  // Keep PBKDF2 fast in tests. Production uses the default in data/config.ts.
  dataConfig.passwordIterations = 1_000
})

beforeEach(async () => {
  await clearAllStores()
  await seedIfEmpty(NOW)
})

async function actorFor(email: string): Promise<Actor> {
  const user = await authenticate({ email, password: DEMO_PASSWORD })
  return { id: user.id, role: user.role }
}

/** Start times of every active appointment, as the slot picker sees them. */
async function bookedStarts(actor: Actor, excludeRequestId?: string): Promise<number[]> {
  return (await getScheduleContext(actor, excludeRequestId)).bookings.map((booking) => booking.startAt)
}

/** The owner's editable schedule: the demo shop's availability without its `updatedAt`. */
async function currentInput(owner: Actor): Promise<AvailabilityInput> {
  const { updatedAt: _ignored, ...rest } = await getAvailability(owner)
  return rest
}

const newRequestInput = {
  serviceId: 'phone',
  itemName: 'Oppo Reno 8',
  description: 'The phone restarts on its own several times a day.',
  mode: 'drop_off',
  address: '',
}

/** Drives a fresh request for `customer` up to the accepted-quotation stage. */
async function acceptedRequest(customer: Actor, owner: Actor): Promise<string> {
  const created = await createRequest(customer, newRequestInput, [], NOW)
  await performAction(owner, created.id, { action: 'start_review' }, NOW)
  await performAction(owner, created.id, { action: 'send_quotation', draft: DRAFT }, NOW)
  await performAction(customer, created.id, { action: 'accept_quotation' }, NOW)
  return created.id
}

describe('seed data', () => {
  it('creates the demo accounts and sample requests once', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const ben = await actorFor(DEMO_ACCOUNTS.secondCustomer.email)

    expect(await listRequests(owner)).toHaveLength(5)
    expect(await listRequests(ana)).toHaveLength(3)
    expect(await listRequests(ben)).toHaveLength(2)

    await seedIfEmpty(NOW)
    expect(await listRequests(owner)).toHaveLength(5)
  })

  it('restores demo data on reset', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    await createRequest(ana, newRequestInput, [], NOW)
    await resetDemoData(NOW)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    expect(await listRequests(owner)).toHaveLength(5)
  })

  it('orders requests with the most recently updated first', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const requests = await listRequests(owner)
    const times = requests.map((request) => request.updatedAt)
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })
})

describe('accounts', () => {
  it('rejects a wrong password and an unknown email with the same message', async () => {
    await expect(authenticate({ email: DEMO_ACCOUNTS.owner.email, password: 'not-the-password' })).rejects.toThrow(
      new AuthError('Email or password is incorrect.'),
    )
    await expect(authenticate({ email: 'nobody@example.com', password: DEMO_PASSWORD })).rejects.toThrow(
      new AuthError('Email or password is incorrect.'),
    )
    await expect(authenticate({ email: 'nobody@example.com', password: DEMO_PASSWORD })).rejects.toBeInstanceOf(AuthError)
  })

  it('registers a customer who can then sign in', async () => {
    const user = await registerCustomer(
      { name: 'Carla Mendoza', email: 'Carla@Example.com', phone: '0917 555 0100', password: 'secret-pass-1' },
      NOW,
    )
    expect(user.role).toBe('customer')
    expect(user.email).toBe('carla@example.com')
    expect(user).not.toHaveProperty('passwordHash')
    const signedIn = await authenticate({ email: 'carla@example.com', password: 'secret-pass-1' })
    expect(signedIn.id).toBe(user.id)
  })

  it('rejects a duplicate email regardless of case', async () => {
    await expect(
      registerCustomer({
        name: 'Another Ana',
        email: 'ANA@fixflow.app',
        phone: '09171234567',
        password: 'secret-pass-1',
      }),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('rejects invalid registration input with field messages', async () => {
    await expect(registerCustomer({ name: '', email: 'x', phone: '1', password: 'short' })).rejects.toBeInstanceOf(
      ValidationError,
    )
  })

  it('shows customer contact details to the owner only', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    expect((await listCustomers(owner)).map((user) => user.name).sort()).toEqual(['Ana Reyes', 'Ben Santos'])
    await expect(listCustomers(ana)).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('rejects an actor whose id does not match a stored user', async () => {
    await expect(listRequests({ id: 'ghost', role: 'owner' })).rejects.toBeInstanceOf(AuthError)
  })

  it('rejects an actor claiming the wrong role', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    await expect(listRequests({ id: ana.id, role: 'owner' })).rejects.toBeInstanceOf(AuthError)
  })
})

describe('createRequest', () => {
  it('assigns the next reference and notifies the owner', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const created = await createRequest(ana, newRequestInput, [], NOW)

    expect(created.ref).toBe('FF-0006')
    expect(created.status).toBe('requested')
    expect(created.history).toHaveLength(1)

    const inbox = await listNotifications(owner.id)
    expect(inbox[0]?.title).toBe('New service request')
    expect(inbox[0]?.body).toContain('FF-0006')
    expect(inbox[0]?.body).toContain('Ana Reyes')
  })

  it('stores photos and returns them in order', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const created = await createRequest(
      ana,
      newRequestInput,
      [
        { name: 'front.jpg', blob: new Blob(['front'], { type: 'image/jpeg' }) },
        { name: 'back.jpg', blob: new Blob(['back'], { type: 'image/jpeg' }) },
      ],
      NOW,
    )
    expect(created.imageIds).toHaveLength(2)
    const asCustomer = await getRequestImages(ana, created.id)
    const asOwner = await getRequestImages(owner, created.id)
    expect(asCustomer.map((image) => image.name)).toEqual(['front.jpg', 'back.jpg'])
    expect(asOwner).toHaveLength(2)
  })

  it('rejects too many photos and non-image files', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const photo = { name: 'p.jpg', blob: new Blob(['x'], { type: 'image/jpeg' }) }
    await expect(createRequest(ana, newRequestInput, Array(5).fill(photo), NOW)).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createRequest(ana, newRequestInput, [{ name: 'a.pdf', blob: new Blob(['x'], { type: 'application/pdf' }) }], NOW),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects a home visit without an address', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    await expect(createRequest(ana, { ...newRequestInput, mode: 'home_visit' }, [], NOW)).rejects.toBeInstanceOf(
      ValidationError,
    )
  })

  it('does not let the owner submit requests', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    await expect(createRequest(owner, newRequestInput, [], NOW)).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('access control', () => {
  it('hides another customer request as not found', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const ben = await actorFor(DEMO_ACCOUNTS.secondCustomer.email)
    const [benRequest] = await listRequests(ben)
    expect(benRequest).toBeDefined()
    await expect(getRequest(ana, benRequest?.id ?? '')).rejects.toBeInstanceOf(NotFoundError)
    await expect(getRequestImages(ana, benRequest?.id ?? '')).rejects.toBeInstanceOf(NotFoundError)
    await expect(performAction(ana, benRequest?.id ?? '', { action: 'cancel', reason: '' }, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })

  it('lets the owner open any request', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const ben = await actorFor(DEMO_ACCOUNTS.secondCustomer.email)
    const [benRequest] = await listRequests(ben)
    await expect(getRequest(owner, benRequest?.id ?? '')).resolves.toMatchObject({ id: benRequest?.id })
  })

  it('reports a missing request as not found', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    await expect(getRequest(owner, 'missing')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('performAction', () => {
  it('notifies the customer when the owner starts a review', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const phone = (await listRequests(ana)).find((request) => request.ref === 'FF-0001')
    expect(phone?.status).toBe('requested')

    const next = await performAction(owner, phone?.id ?? '', { action: 'start_review' }, NOW)
    expect(next.status).toBe('under_review')

    const stored = await getRequest(ana, next.id)
    expect(stored.status).toBe('under_review')
    expect((await listNotifications(ana.id))[0]?.title).toBe('Your request is under review')
  })

  it('refuses actions the role is not allowed to take', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const phone = (await listRequests(ana)).find((request) => request.ref === 'FF-0001')
    await expect(performAction(ana, phone?.id ?? '', { action: 'start_review' }, NOW)).rejects.toBeInstanceOf(
      ForbiddenError,
    )
  })

  it('walks a new request all the way to feedback', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const id = await acceptedRequest(ana, owner)
    await performAction(ana, id, { action: 'schedule', startAt: at(7, 15) }, NOW)
    await performAction(owner, id, { action: 'start_service' }, NOW)
    await performAction(owner, id, { action: 'complete_service' }, NOW)
    const done = await performAction(ana, id, { action: 'submit_feedback', feedback: { rating: 5, comment: 'Great' } }, NOW)
    expect(done.status).toBe('feedback')
    expect(done.history.map((item) => item.status)).toHaveLength(8)
  })
})

describe('scheduling is atomic', () => {
  it('rolls back everything when the slot is full', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)

    // The seeded washing machine visit already holds one of two places on Tuesday at 10 AM.
    expect(await bookedStarts(owner)).toContain(at(6, 10))

    const first = await acceptedRequest(ana, owner)
    await performAction(ana, first, { action: 'schedule', startAt: at(6, 10) }, NOW)
    expect(await bookedStarts(owner)).toEqual(expect.arrayContaining([at(6, 10), at(6, 10)]))

    const second = await acceptedRequest(ana, owner)
    const notificationsBefore = (await listNotifications(owner.id)).length
    await expect(performAction(ana, second, { action: 'schedule', startAt: at(6, 10) }, NOW)).rejects.toBeInstanceOf(
      ConflictError,
    )

    const unchanged = await getRequest(ana, second)
    expect(unchanged.status).toBe('quotation_accepted')
    expect(unchanged.appointment).toBeNull()
    expect((await listNotifications(owner.id)).length).toBe(notificationsBefore)
  })

  it('lets only one of two simultaneous bookings win the last place', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const first = await acceptedRequest(ana, owner)
    const second = await acceptedRequest(ana, owner)

    const results = await Promise.allSettled([
      performAction(ana, first, { action: 'schedule', startAt: at(6, 10) }, NOW),
      performAction(ana, second, { action: 'schedule', startAt: at(6, 10) }, NOW),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected')
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(ConflictError)
  })

  it('does not count the request being rescheduled against itself', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const id = await acceptedRequest(ana, owner)
    await performAction(ana, id, { action: 'schedule', startAt: at(6, 10) }, NOW)
    const moved = await performAction(owner, id, { action: 'schedule', startAt: at(6, 10) }, NOW)
    expect(moved.appointment?.updatedAt).toBe(NOW)
  })
})

describe('notifications', () => {
  it('marks one and then all as read', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const inbox = await listNotifications(ana.id)
    expect(inbox.filter((item) => item.readAt === null).length).toBe(2)

    await markNotificationRead(ana.id, inbox[0]?.id ?? '', NOW)
    expect((await listNotifications(ana.id)).filter((item) => item.readAt === null).length).toBe(1)

    await markAllNotificationsRead(ana.id, NOW)
    expect((await listNotifications(ana.id)).every((item) => item.readAt !== null)).toBe(true)
  })

  it('does not let one user mark another user notification', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const ben = await actorFor(DEMO_ACCOUNTS.secondCustomer.email)
    const [first] = await listNotifications(ana.id)
    await expect(markNotificationRead(ben.id, first?.id ?? '', NOW)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('corrupted storage', () => {
  it('fails loudly instead of showing malformed rows', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    await runTx(['requests'], 'readwrite', async (tx) => {
      await idb(tx.objectStore('requests').put({ id: 'broken', customerId: 'x' }))
    })
    await expect(listRequests(owner)).rejects.toBeInstanceOf(StorageError)
  })
})

describe('shop availability', () => {
  it('seeds the demo shop with a lunch break and one-hour slots', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const shop = await getAvailability(owner)
    expect(shop).toMatchObject({ slotMinutes: 60, capacity: 2, lunch: { enabled: true, from: 720, to: 780 } })
  })

  it('falls back to the default week until the owner saves one', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    await runTx(['meta'], 'readwrite', async (tx) => {
      await idb(tx.objectStore('meta').delete(AVAILABILITY_KEY))
    })
    expect(await getAvailability(owner)).toEqual(defaultAvailability())
  })

  it('lets customers read it but not change it', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    expect(await getAvailability(ana)).toEqual(await getAvailability(owner))
    await expect(saveAvailability(ana, await currentInput(owner), NOW)).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('saves the owner schedule and shows it to customers straight away', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const next = { ...(await currentInput(owner)), slotMinutes: 30 as const, capacity: 3, windowDays: 30 as const }

    const saved = await saveAvailability(owner, next, NOW + 1000)
    expect(saved).toMatchObject({ slotMinutes: 30, capacity: 3, windowDays: 30, updatedAt: NOW + 1000 })
    expect(await getAvailability(ana)).toEqual(saved)
  })

  it('refuses an invalid schedule and keeps the old one', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const before = await getAvailability(owner)
    const broken = { ...(await currentInput(owner)), week: withDay(makeAvailability(), 1, { from: 15 * 60, to: 10 * 60 }).week }

    const failure = await saveAvailability(owner, broken, NOW).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ValidationError)
    expect(failure instanceof ValidationError && failure.fields['week.1.to']).toBeDefined()
    expect(await getAvailability(owner)).toEqual(before)
  })

  it('refuses data that is not a schedule at all', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    await expect(saveAvailability(owner, { week: 'closed' }, NOW)).rejects.toBeInstanceOf(ValidationError)
    await expect(saveAvailability(owner, null, NOW)).rejects.toBeInstanceOf(ValidationError)
  })

  it('sorts days off and drops the ones already past', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const saved = await saveAvailability(
      owner,
      {
        ...(await currentInput(owner)),
        daysOff: [
          { date: '2026-10-20', label: 'Later' },
          { date: '2026-10-01', label: 'Past' },
          { date: '2026-10-10', label: 'Sooner' },
        ],
      },
      NOW,
    )
    expect(saved.daysOff.map((entry) => entry.label)).toEqual(['Sooner', 'Later'])
  })

  it('stops customers booking days the owner closes', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const id = await acceptedRequest(ana, owner)
    const base = await currentInput(owner)

    await saveAvailability(owner, { ...base, week: withDay(makeAvailability(), 2, { open: false }).week }, NOW)
    await expect(performAction(ana, id, { action: 'schedule', startAt: at(6, 14) }, NOW)).rejects.toBeInstanceOf(
      ValidationError,
    )

    await saveAvailability(owner, { ...base, daysOff: [{ date: '2026-10-07', label: 'Holiday' }] }, NOW)
    await expect(performAction(ana, id, { action: 'schedule', startAt: at(7, 14) }, NOW)).rejects.toBeInstanceOf(
      ValidationError,
    )
    // Tuesday is open again, so this goes through.
    const booked = await performAction(ana, id, { action: 'schedule', startAt: at(6, 14) }, NOW)
    expect(booked.status).toBe('scheduled')
  })

  it('keeps the lunch break free', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const id = await acceptedRequest(ana, owner)
    await expect(performAction(ana, id, { action: 'schedule', startAt: at(7, 12) }, NOW)).rejects.toBeInstanceOf(
      ValidationError,
    )
    await expect(performAction(ana, id, { action: 'schedule', startAt: at(7, 13) }, NOW)).resolves.toMatchObject({
      status: 'scheduled',
    })
  })

  it('applies a smaller capacity to visits that are already booked', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const id = await acceptedRequest(ana, owner)
    // The seeded washing machine visit holds Tuesday 10 AM. With one technician, that slot is full.
    await saveAvailability(owner, { ...(await currentInput(owner)), capacity: 1 }, NOW)
    await expect(performAction(ana, id, { action: 'schedule', startAt: at(6, 10) }, NOW)).rejects.toBeInstanceOf(
      ConflictError,
    )
    await expect(performAction(ana, id, { action: 'schedule', startAt: at(6, 11) }, NOW)).resolves.toMatchObject({
      status: 'scheduled',
    })
  })

  it('records the slot length on each booking and protects older, longer visits', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const id = await acceptedRequest(ana, owner)
    await saveAvailability(owner, { ...(await currentInput(owner)), slotMinutes: 30, capacity: 1 }, NOW)

    // The seeded visit is a one-hour Tuesday 10 AM booking, so 10:30 overlaps it even on a 30 minute grid.
    await expect(
      performAction(ana, id, { action: 'schedule', startAt: atMinute(6, 10, 30) }, NOW),
    ).rejects.toBeInstanceOf(ConflictError)

    const booked = await performAction(ana, id, { action: 'schedule', startAt: atMinute(6, 11, 0) }, NOW)
    expect(booked.appointment?.durationMinutes).toBe(30)

    const { bookings } = await getScheduleContext(owner)
    const mine = bookings.find((entry) => entry.startAt === atMinute(6, 11, 0))
    expect(mine?.endAt).toBe(atMinute(6, 11, 30))
    const seeded = bookings.find((entry) => entry.startAt === at(6, 10))
    expect(seeded?.endAt).toBe(at(6, 11))
  })

  it('never moves or cancels visits that are already booked', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const before = (await listRequests(owner)).find((request) => request.ref === 'FF-0005')
    await saveAvailability(
      owner,
      { ...(await currentInput(owner)), week: withDay(makeAvailability(), 2, { open: false }).week },
      NOW,
    )
    const after = (await listRequests(owner)).find((request) => request.ref === 'FF-0005')
    expect(after).toEqual(before)
    expect(after?.status).toBe('scheduled')
  })

  it('excludes the request being rescheduled from the bookings the picker sees', async () => {
    const ana = await actorFor(DEMO_ACCOUNTS.customer.email)
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    const id = await acceptedRequest(ana, owner)
    await performAction(ana, id, { action: 'schedule', startAt: at(7, 15) }, NOW)
    expect(await bookedStarts(ana)).toContain(at(7, 15))
    expect(await bookedStarts(ana, id)).not.toContain(at(7, 15))
  })

  it('fails loudly when the stored schedule is corrupted', async () => {
    const owner = await actorFor(DEMO_ACCOUNTS.owner.email)
    await runTx(['meta'], 'readwrite', async (tx) => {
      await idb(tx.objectStore('meta').put({ key: AVAILABILITY_KEY, value: { week: [] } }))
    })
    await expect(getAvailability(owner)).rejects.toBeInstanceOf(StorageError)
  })

  it('does not hand the schedule to someone who is not signed in as a real user', async () => {
    await expect(getAvailability({ id: 'nobody', role: 'customer' })).rejects.toBeInstanceOf(AuthError)
  })
})
