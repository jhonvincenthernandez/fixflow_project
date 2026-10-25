import {
  AuthError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors'
import { AvailabilityInputSchema, AvailabilitySchema, defaultAvailability, tidyDaysOff } from '@/domain/availability'
import type { Availability } from '@/domain/availability'
import { newId, formatRef } from '@/domain/ids'
import { toBooking } from '@/domain/schedule'
import type { Booking } from '@/domain/schedule'
import {
  LoginInputSchema,
  MAX_IMAGES,
  NewRequestInputSchema,
  NotificationSchema,
  RegisterInputSchema,
  ServiceRequestSchema,
  UserSchema,
  parseOrThrow,
} from '@/domain/types'
import type { AppNotification, PublicUser, ServiceRequest, User } from '@/domain/types'
import { applyAction, notificationsFor } from '@/domain/workflow'
import type { ActionInput, Actor, NotificationDraft } from '@/domain/workflow'
import { dataConfig } from './config'
import { idb, parseRow, parseRows, runTx } from './db'
import { AVAILABILITY_KEY, REQUEST_COUNTER_KEY } from './meta'
import { hashPassword, verifyPassword } from './password'
import { z } from 'zod'

/* ------------------------------------------------------------
   Shared helpers
   ------------------------------------------------------------ */
export interface StoredImage {
  readonly id: string
  readonly requestId: string
  readonly name: string
  readonly blob: Blob
}

export interface ImageUpload {
  readonly name: string
  readonly blob: Blob
}

const StoredImageSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
  name: z.string(),
  blob: z.custom<Blob>((value) => value instanceof Blob, 'Expected an image blob'),
})

const MetaCounterSchema = z.object({ key: z.string(), value: z.number().int().nonnegative() })

const StoredAvailabilitySchema = z.object({ key: z.literal(AVAILABILITY_KEY), value: AvailabilitySchema })

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
  }
}

function newestFirst(requests: readonly ServiceRequest[]): ServiceRequest[] {
  return [...requests].sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Reads the user row inside a transaction and confirms the actor is who they claim to be. */
async function requireActor(tx: IDBTransaction, actor: Actor): Promise<User> {
  const row: unknown = await idb(tx.objectStore('users').get(actor.id))
  if (row === undefined) throw new AuthError()
  const user = parseRow(UserSchema, row, 'user')
  if (user.role !== actor.role) throw new AuthError()
  return user
}

async function ownerIdsIn(tx: IDBTransaction): Promise<string[]> {
  const rows: unknown[] = await idb(tx.objectStore('users').getAll())
  return parseRows(UserSchema, rows, 'user')
    .filter((user) => user.role === 'owner')
    .map((user) => user.id)
}

function toNotification(draft: NotificationDraft, requestId: string, now: number): AppNotification {
  return {
    id: newId(),
    userId: draft.userId,
    requestId,
    title: draft.title,
    body: draft.body,
    createdAt: now,
    readAt: null,
  }
}

async function putNotifications(
  tx: IDBTransaction,
  drafts: readonly NotificationDraft[],
  requestId: string,
  now: number,
): Promise<void> {
  const store = tx.objectStore('notifications')
  await Promise.all(drafts.map((draft) => idb(store.put(toNotification(draft, requestId, now)))))
}

/* ------------------------------------------------------------
   Accounts
   ------------------------------------------------------------ */
export async function registerCustomer(input: unknown, now: number = Date.now()): Promise<PublicUser> {
  const parsed = parseOrThrow(RegisterInputSchema, input)
  // Hash first: PBKDF2 is async and slow, and a transaction would auto-commit while it ran.
  const record = await hashPassword(parsed.password)
  const user: User = {
    id: newId(),
    role: 'customer',
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    ...record,
    createdAt: now,
  }

  await runTx(['users'], 'readwrite', async (tx) => {
    const store = tx.objectStore('users')
    const existing: unknown = await idb(store.index('email').get(user.email))
    if (existing !== undefined) {
      throw new ConflictError('An account with that email already exists. Sign in instead.')
    }
    await idb(store.put(user))
  })
  return toPublicUser(user)
}

export async function authenticate(input: unknown): Promise<PublicUser> {
  const parsed = parseOrThrow(LoginInputSchema, input)
  const row = await runTx(['users'], 'readonly', async (tx) => {
    const found: unknown = await idb(tx.objectStore('users').index('email').get(parsed.email))
    return found
  })
  const invalid = new AuthError('Email or password is incorrect.')
  if (row === undefined) throw invalid
  const user = parseRow(UserSchema, row, 'user')
  if (!(await verifyPassword(parsed.password, user))) throw invalid
  return toPublicUser(user)
}

export async function getUser(id: string): Promise<PublicUser> {
  const row = await runTx(['users'], 'readonly', async (tx) => {
    const found: unknown = await idb(tx.objectStore('users').get(id))
    return found
  })
  if (row === undefined) throw new AuthError()
  return toPublicUser(parseRow(UserSchema, row, 'user'))
}

/** Owner-only: customer names and phone numbers for the request list and detail views. */
export async function listCustomers(actor: Actor): Promise<PublicUser[]> {
  return runTx(['users'], 'readonly', async (tx) => {
    await requireActor(tx, actor)
    if (actor.role !== 'owner') throw new ForbiddenError('Only the shop can view customers.')
    const rows: unknown[] = await idb(tx.objectStore('users').getAll())
    return parseRows(UserSchema, rows, 'user')
      .filter((user) => user.role === 'customer')
      .map(toPublicUser)
  })
}

/* ------------------------------------------------------------
   Requests
   ------------------------------------------------------------ */
export async function listRequests(actor: Actor): Promise<ServiceRequest[]> {
  return runTx(['users', 'requests'], 'readonly', async (tx) => {
    await requireActor(tx, actor)
    const store = tx.objectStore('requests')
    const rows: unknown[] =
      actor.role === 'owner' ? await idb(store.getAll()) : await idb(store.index('customerId').getAll(actor.id))
    return newestFirst(parseRows(ServiceRequestSchema, rows, 'request'))
  })
}

export async function getRequest(actor: Actor, id: string): Promise<ServiceRequest> {
  return runTx(['users', 'requests'], 'readonly', async (tx) => {
    await requireActor(tx, actor)
    const row: unknown = await idb(tx.objectStore('requests').get(id))
    const notFound = new NotFoundError('We could not find that request.')
    if (row === undefined) throw notFound
    const request = parseRow(ServiceRequestSchema, row, 'request')
    // A customer asking for someone else's request gets the same answer as a missing one.
    if (actor.role === 'customer' && request.customerId !== actor.id) throw notFound
    return request
  })
}

export async function createRequest(
  actor: Actor,
  input: unknown,
  uploads: readonly ImageUpload[],
  now: number = Date.now(),
): Promise<ServiceRequest> {
  if (actor.role !== 'customer') throw new ForbiddenError('Only customers can submit requests.')
  const parsed = parseOrThrow(NewRequestInputSchema, input)

  if (uploads.length > MAX_IMAGES) {
    throw new ValidationError({ images: [`Attach up to ${MAX_IMAGES} photos.`] })
  }
  for (const upload of uploads) {
    if (!upload.blob.type.startsWith('image/')) {
      throw new ValidationError({ images: ['Only image files can be attached.'] })
    }
    if (upload.blob.size > dataConfig.maxImageBytes) {
      throw new ValidationError({ images: ['One of the photos is too large. Choose a smaller one.'] })
    }
  }

  return runTx(['users', 'requests', 'images', 'notifications', 'meta'], 'readwrite', async (tx) => {
    const customer = await requireActor(tx, actor)

    const meta = tx.objectStore('meta')
    const counterRow: unknown = await idb(meta.get(REQUEST_COUNTER_KEY))
    const previous = counterRow === undefined ? 0 : parseRow(MetaCounterSchema, counterRow, 'counter').value
    const sequence = previous + 1
    await idb(meta.put({ key: REQUEST_COUNTER_KEY, value: sequence }))

    const id = newId()
    const imageIds = uploads.map(() => newId())
    const request: ServiceRequest = {
      id,
      ref: formatRef(sequence),
      customerId: customer.id,
      serviceId: parsed.serviceId,
      itemName: parsed.itemName,
      description: parsed.description,
      mode: parsed.mode,
      address: parsed.mode === 'home_visit' ? parsed.address : '',
      imageIds,
      status: 'requested',
      quotation: null,
      appointment: null,
      feedback: null,
      closure: null,
      history: [{ status: 'requested', at: now, by: 'customer', note: '' }],
      createdAt: now,
      updatedAt: now,
    }

    const images = tx.objectStore('images')
    await Promise.all(
      uploads.map((upload, index) =>
        idb(images.put({ id: imageIds[index], requestId: id, name: upload.name, blob: upload.blob })),
      ),
    )
    await idb(tx.objectStore('requests').put(request))

    const ownerIds = await ownerIdsIn(tx)
    await putNotifications(
      tx,
      ownerIds.map((userId) => ({
        userId,
        title: 'New service request',
        body: `${request.ref}: ${customer.name} submitted a request for ${request.itemName}.`,
      })),
      id,
      now,
    )
    return request
  })
}

/** Time ranges of every active appointment, optionally excluding one request. No personal data. */
function activeBookings(requests: readonly ServiceRequest[], excludeRequestId?: string): Booking[] {
  return requests
    .filter((request) => request.status === 'scheduled' && request.id !== excludeRequestId)
    .flatMap((request) => (request.appointment === null ? [] : [toBooking(request.appointment)]))
}

/** The owner's availability, or the shop's defaults until the owner saves their own. */
async function readAvailability(tx: IDBTransaction): Promise<Availability> {
  const row: unknown = await idb(tx.objectStore('meta').get(AVAILABILITY_KEY))
  return row === undefined ? defaultAvailability() : parseRow(StoredAvailabilitySchema, row, 'availability').value
}

/**
 * Applies one workflow action atomically. The slot check (against the availability stored right
 * now), the status change and the notifications commit together or not at all, so two people
 * cannot book the same slot and nobody books time the owner has just closed.
 */
export async function performAction(
  actor: Actor,
  requestId: string,
  input: ActionInput,
  now: number = Date.now(),
): Promise<ServiceRequest> {
  return runTx(['users', 'requests', 'notifications', 'meta'], 'readwrite', async (tx) => {
    await requireActor(tx, actor)
    const requests = tx.objectStore('requests')

    const row: unknown = await idb(requests.get(requestId))
    const notFound = new NotFoundError('We could not find that request.')
    if (row === undefined) throw notFound
    const current = parseRow(ServiceRequestSchema, row, 'request')
    if (actor.role === 'customer' && current.customerId !== actor.id) throw notFound

    let bookings: Booking[] = []
    let availability = defaultAvailability()
    if (input.action === 'schedule') {
      availability = await readAvailability(tx)
      const all: unknown[] = await idb(requests.getAll())
      bookings = activeBookings(parseRows(ServiceRequestSchema, all, 'request'), requestId)
    }

    const next = applyAction(current, input, actor, { now, bookings, availability })
    await idb(requests.put(next))

    const ownerIds = await ownerIdsIn(tx)
    await putNotifications(tx, notificationsFor(next, input, actor, ownerIds), requestId, now)
    return next
  })
}

/* ------------------------------------------------------------
   Availability (managed by the owner, read by everyone)
   ------------------------------------------------------------ */
export interface ScheduleContext {
  readonly availability: Availability
  readonly bookings: readonly Booking[]
}

export async function getAvailability(actor: Actor): Promise<Availability> {
  return runTx(['users', 'meta'], 'readonly', async (tx) => {
    await requireActor(tx, actor)
    return readAvailability(tx)
  })
}

/** Everything a slot picker needs, read in one transaction so the two halves agree. */
export async function getScheduleContext(actor: Actor, excludeRequestId?: string): Promise<ScheduleContext> {
  return runTx(['users', 'meta', 'requests'], 'readonly', async (tx) => {
    await requireActor(tx, actor)
    const availability = await readAvailability(tx)
    const rows: unknown[] = await idb(tx.objectStore('requests').getAll())
    return { availability, bookings: activeBookings(parseRows(ServiceRequestSchema, rows, 'request'), excludeRequestId) }
  })
}

/**
 * Owner only. Saving never cancels or moves appointments that are already booked; the owner
 * screen warns about any that now fall outside the new hours instead.
 */
export async function saveAvailability(actor: Actor, input: unknown, now: number = Date.now()): Promise<Availability> {
  if (actor.role !== 'owner') throw new ForbiddenError('Only the shop owner can change the schedule.')
  const parsed = parseOrThrow(AvailabilityInputSchema, input)
  const availability: Availability = { ...parsed, daysOff: tidyDaysOff(parsed.daysOff, now), updatedAt: now }

  await runTx(['users', 'meta'], 'readwrite', async (tx) => {
    await requireActor(tx, actor)
    await idb(tx.objectStore('meta').put({ key: AVAILABILITY_KEY, value: availability }))
  })
  return availability
}

export async function getRequestImages(actor: Actor, requestId: string): Promise<StoredImage[]> {
  return runTx(['users', 'requests', 'images'], 'readonly', async (tx) => {
    await requireActor(tx, actor)
    const row: unknown = await idb(tx.objectStore('requests').get(requestId))
    const notFound = new NotFoundError('We could not find that request.')
    if (row === undefined) throw notFound
    const request = parseRow(ServiceRequestSchema, row, 'request')
    if (actor.role === 'customer' && request.customerId !== actor.id) throw notFound

    const rows: unknown[] = await idb(tx.objectStore('images').index('requestId').getAll(requestId))
    const byId = new Map(parseRows(StoredImageSchema, rows, 'image').map((image) => [image.id, image]))
    return request.imageIds.flatMap((id) => {
      const image = byId.get(id)
      return image === undefined ? [] : [image]
    })
  })
}

/* ------------------------------------------------------------
   Notifications
   ------------------------------------------------------------ */
export async function listNotifications(userId: string): Promise<AppNotification[]> {
  return runTx(['notifications'], 'readonly', async (tx) => {
    const rows: unknown[] = await idb(tx.objectStore('notifications').index('userId').getAll(userId))
    return [...parseRows(NotificationSchema, rows, 'notification')].sort((a, b) => b.createdAt - a.createdAt)
  })
}

export async function markNotificationRead(userId: string, id: string, now: number = Date.now()): Promise<void> {
  await runTx(['notifications'], 'readwrite', async (tx) => {
    const store = tx.objectStore('notifications')
    const row: unknown = await idb(store.get(id))
    if (row === undefined) throw new NotFoundError('We could not find that notification.')
    const notification = parseRow(NotificationSchema, row, 'notification')
    if (notification.userId !== userId) throw new NotFoundError('We could not find that notification.')
    if (notification.readAt !== null) return
    await idb(store.put({ ...notification, readAt: now }))
  })
}

export async function markAllNotificationsRead(userId: string, now: number = Date.now()): Promise<void> {
  await runTx(['notifications'], 'readwrite', async (tx) => {
    const store = tx.objectStore('notifications')
    const rows: unknown[] = await idb(store.index('userId').getAll(userId))
    const unread = parseRows(NotificationSchema, rows, 'notification').filter((item) => item.readAt === null)
    await Promise.all(unread.map((item) => idb(store.put({ ...item, readAt: now }))))
  })
}
