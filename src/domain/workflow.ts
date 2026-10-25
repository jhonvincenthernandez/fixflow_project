import { ConflictError, ForbiddenError } from './errors'
import { formatDateTime } from './format'
import { buildQuotation } from './quotation'
import type { Availability } from './availability'
import { validateSlot } from './schedule'
import type { Booking } from './schedule'
import { FeedbackInputSchema, ReasonSchema, parseOrThrow } from './types'
import type { FeedbackInput, HistoryEntry, Quotation, QuotationDraft, RequestStatus, Role, ServiceRequest } from './types'

/* ------------------------------------------------------------
   Stages (from the FixFlow workflow)
   ------------------------------------------------------------ */
export interface Stage {
  readonly status: RequestStatus
  readonly label: string
  readonly description: string
}

export const STAGES: readonly Stage[] = [
  { status: 'requested', label: 'Request', description: 'Customer submits a repair or service request.' },
  { status: 'under_review', label: 'Under review', description: 'Business checks and evaluates the request.' },
  { status: 'quotation_sent', label: 'Quotation sent', description: 'Business provides the quotation and estimated cost.' },
  { status: 'quotation_accepted', label: 'Quotation accepted', description: 'Customer reviews and approves the quotation.' },
  { status: 'scheduled', label: 'Scheduled', description: 'An appointment is arranged.' },
  { status: 'in_progress', label: 'In progress', description: 'The repair or service is being performed.' },
  { status: 'completed', label: 'Completed', description: 'The repair or service is finished and recorded.' },
  { status: 'feedback', label: 'Feedback', description: 'Customer can provide feedback about the completed service.' },
]

export const STATUS_LABEL: Record<RequestStatus, string> = {
  requested: 'Requested',
  under_review: 'Under review',
  quotation_sent: 'Quotation sent',
  quotation_accepted: 'Quotation accepted',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  feedback: 'Feedback given',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

/** Position in the eight-stage flow, or -1 for the declined and cancelled off-ramps. */
export function stageIndex(status: RequestStatus): number {
  return STAGES.findIndex((stage) => stage.status === status)
}

export const TERMINAL_STATUSES: readonly RequestStatus[] = ['feedback', 'declined', 'cancelled']

export function isTerminal(status: RequestStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function isClosedEarly(status: RequestStatus): boolean {
  return status === 'declined' || status === 'cancelled'
}

/** Who has to act next, or null when the request is closed. Drives "needs your action" lists. */
export function actionOwner(status: RequestStatus): Role | null {
  switch (status) {
    case 'requested':
    case 'under_review':
    case 'scheduled':
    case 'in_progress':
      return 'owner'
    case 'quotation_sent':
    case 'quotation_accepted':
    case 'completed':
      return 'customer'
    case 'feedback':
    case 'declined':
    case 'cancelled':
      return null
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

/** One short line telling each side what happens next. Shown on cards and the detail header. */
const NEXT_STEP: Record<Role, Record<RequestStatus, string>> = {
  customer: {
    requested: 'Waiting for the shop to review your request',
    under_review: 'The shop is preparing your quotation',
    quotation_sent: 'Review and respond to the quotation',
    quotation_accepted: 'Choose an appointment time',
    scheduled: 'Your appointment is booked',
    in_progress: 'Your repair is in progress',
    completed: 'Tell us how the repair went',
    feedback: 'Thanks for your feedback',
    declined: 'You declined the quotation',
    cancelled: 'This request was cancelled',
  },
  owner: {
    requested: 'Review this new request',
    under_review: 'Prepare and send a quotation',
    quotation_sent: 'Waiting for the customer to respond',
    quotation_accepted: 'Waiting for the customer to book a time',
    scheduled: 'Start the service on the appointment day',
    in_progress: 'Mark as completed when the work is done',
    completed: 'Waiting for customer feedback',
    feedback: 'Feedback received',
    declined: 'The customer declined the quotation',
    cancelled: 'This request was cancelled',
  },
}

export function nextStepText(status: RequestStatus, role: Role): string {
  return NEXT_STEP[role][status]
}

/* ------------------------------------------------------------
   Actions and transition rules
   ------------------------------------------------------------ */
export const ACTION_IDS = [
  'start_review',
  'send_quotation',
  'revise_quotation',
  'accept_quotation',
  'decline_quotation',
  'schedule',
  'start_service',
  'complete_service',
  'submit_feedback',
  'cancel',
] as const
export type ActionId = (typeof ACTION_IDS)[number]

interface ActionRule {
  readonly from: readonly RequestStatus[]
  readonly to: RequestStatus
  readonly roles: readonly Role[]
}

const CANCELLABLE: readonly RequestStatus[] = [
  'requested',
  'under_review',
  'quotation_sent',
  'quotation_accepted',
  'scheduled',
]

export const ACTION_RULES: Record<ActionId, ActionRule> = {
  start_review: { from: ['requested'], to: 'under_review', roles: ['owner'] },
  send_quotation: { from: ['under_review'], to: 'quotation_sent', roles: ['owner'] },
  revise_quotation: { from: ['quotation_sent'], to: 'under_review', roles: ['owner'] },
  accept_quotation: { from: ['quotation_sent'], to: 'quotation_accepted', roles: ['customer'] },
  decline_quotation: { from: ['quotation_sent'], to: 'declined', roles: ['customer'] },
  schedule: { from: ['quotation_accepted', 'scheduled'], to: 'scheduled', roles: ['customer', 'owner'] },
  start_service: { from: ['scheduled'], to: 'in_progress', roles: ['owner'] },
  complete_service: { from: ['in_progress'], to: 'completed', roles: ['owner'] },
  submit_feedback: { from: ['completed'], to: 'feedback', roles: ['customer'] },
  cancel: { from: CANCELLABLE, to: 'cancelled', roles: ['customer', 'owner'] },
}

export function availableActions(status: RequestStatus, role: Role): ActionId[] {
  return ACTION_IDS.filter((id) => {
    const rule = ACTION_RULES[id]
    return rule.roles.includes(role) && rule.from.includes(status)
  })
}

export function actionLabel(action: ActionId, status: RequestStatus): string {
  switch (action) {
    case 'start_review':
      return 'Start review'
    case 'send_quotation':
      return 'Prepare quotation'
    case 'revise_quotation':
      return 'Revise quotation'
    case 'accept_quotation':
      return 'Accept quotation'
    case 'decline_quotation':
      return 'Decline quotation'
    case 'schedule':
      return status === 'scheduled' ? 'Reschedule' : 'Schedule appointment'
    case 'start_service':
      return 'Start service'
    case 'complete_service':
      return 'Mark as completed'
    case 'submit_feedback':
      return 'Leave feedback'
    case 'cancel':
      return 'Cancel request'
    default: {
      const unreachable: never = action
      return unreachable
    }
  }
}

/** Every action together with the data it needs. Discriminated on `action`. */
export type ActionInput =
  | { readonly action: 'start_review' }
  | { readonly action: 'send_quotation'; readonly draft: QuotationDraft }
  | { readonly action: 'revise_quotation' }
  | { readonly action: 'accept_quotation' }
  | { readonly action: 'decline_quotation'; readonly reason: string }
  | { readonly action: 'schedule'; readonly startAt: number }
  | { readonly action: 'start_service' }
  | { readonly action: 'complete_service' }
  | { readonly action: 'submit_feedback'; readonly feedback: FeedbackInput }
  | { readonly action: 'cancel'; readonly reason: string }

export interface Actor {
  readonly id: string
  readonly role: Role
}

export interface ActionContext {
  readonly now: number
  /** Every other active appointment, excluding this request's own. */
  readonly bookings: readonly Booking[]
  /** The owner's availability at the moment of booking. */
  readonly availability: Availability
}

interface Patch {
  readonly patch: Partial<ServiceRequest>
  readonly note: string
}

function requireQuotation(request: ServiceRequest): Quotation {
  if (request.quotation === null) {
    throw new ConflictError('This request has no quotation yet. Refresh to see the latest status.')
  }
  return request.quotation
}

function computePatch(request: ServiceRequest, input: ActionInput, actor: Actor, context: ActionContext): Patch {
  const { now } = context
  switch (input.action) {
    case 'start_review':
      return { patch: {}, note: '' }
    case 'send_quotation':
      return { patch: { quotation: buildQuotation(input.draft, now) }, note: '' }
    case 'revise_quotation':
      return { patch: { quotation: null }, note: 'Quotation withdrawn for revision' }
    case 'accept_quotation': {
      const quotation = requireQuotation(request)
      if (now > quotation.validUntil) {
        throw new ConflictError('This quotation has expired. Ask the shop for a new one.')
      }
      return { patch: { quotation: { ...quotation, response: 'accepted', respondedAt: now } }, note: '' }
    }
    case 'decline_quotation': {
      const quotation = requireQuotation(request)
      const reason = parseOrThrow(ReasonSchema, input.reason)
      return {
        patch: {
          quotation: { ...quotation, response: 'declined', respondedAt: now },
          closure: { by: 'customer', reason },
        },
        note: reason,
      }
    }
    case 'schedule': {
      validateSlot(input.startAt, now, context.bookings, context.availability)
      return {
        patch: {
          appointment: {
            startAt: input.startAt,
            durationMinutes: context.availability.slotMinutes,
            createdBy: actor.role,
            updatedAt: now,
          },
        },
        note: request.status === 'scheduled' ? 'Rescheduled' : '',
      }
    }
    case 'start_service':
      return { patch: {}, note: '' }
    case 'complete_service':
      return { patch: {}, note: '' }
    case 'submit_feedback': {
      const feedback = parseOrThrow(FeedbackInputSchema, input.feedback)
      return { patch: { feedback: { rating: feedback.rating, comment: feedback.comment, createdAt: now } }, note: '' }
    }
    case 'cancel': {
      const reason = parseOrThrow(ReasonSchema, input.reason)
      return { patch: { closure: { by: actor.role, reason } }, note: reason }
    }
    default: {
      const unreachable: never = input
      return unreachable
    }
  }
}

/**
 * The single place a request changes status. Pure: returns a new request or throws.
 * Callers (the data layer) run it inside one database transaction so two devices or
 * tabs cannot both win a race for the same slot or the same transition.
 */
export function applyAction(
  request: ServiceRequest,
  input: ActionInput,
  actor: Actor,
  context: ActionContext,
): ServiceRequest {
  if (actor.role === 'customer' && request.customerId !== actor.id) {
    throw new ForbiddenError('This request belongs to another customer.')
  }

  const rule = ACTION_RULES[input.action]
  if (!rule.roles.includes(actor.role)) {
    throw new ForbiddenError('You cannot do that on this request.')
  }
  if (!rule.from.includes(request.status)) {
    throw new ConflictError('This request has moved on. Refresh to see the latest status.')
  }

  const { patch, note } = computePatch(request, input, actor, context)
  const entry: HistoryEntry = { status: rule.to, at: context.now, by: actor.role, note }

  return {
    ...request,
    ...patch,
    status: rule.to,
    updatedAt: context.now,
    history: [...request.history, entry],
  }
}

/* ------------------------------------------------------------
   Notifications raised by each action
   ------------------------------------------------------------ */
export interface NotificationDraft {
  readonly userId: string
  readonly title: string
  readonly body: string
}

function withReason(text: string, reason: string): string {
  return reason.length > 0 ? `${text} Reason: ${reason}` : text
}

function messageFor(request: ServiceRequest, input: ActionInput, actor: Actor): { title: string; body: string } {
  const ref = request.ref
  const item = request.itemName
  switch (input.action) {
    case 'start_review':
      return { title: 'Your request is under review', body: `${ref}: the shop is reviewing your ${item}.` }
    case 'send_quotation':
      return { title: 'Your quotation is ready', body: `${ref}: review the quotation for your ${item}.` }
    case 'revise_quotation':
      return { title: 'Quotation being revised', body: `${ref}: the shop is updating the quotation for your ${item}.` }
    case 'accept_quotation':
      return { title: 'Quotation accepted', body: `${ref}: the customer accepted the quotation for ${item}.` }
    case 'decline_quotation':
      return {
        title: 'Quotation declined',
        body: withReason(`${ref}: the customer declined the quotation for ${item}.`, input.reason.trim()),
      }
    case 'schedule':
      return {
        title: 'Appointment scheduled',
        body: `${ref}: ${item} on ${formatDateTime(input.startAt)}.`,
      }
    case 'start_service':
      return { title: 'Repair started', body: `${ref}: work on your ${item} has started.` }
    case 'complete_service':
      return { title: 'Repair completed', body: `${ref}: your ${item} is done. Tell us how it went.` }
    case 'submit_feedback':
      return { title: 'New feedback', body: `${ref}: ${input.feedback.rating} out of 5 stars for ${item}.` }
    case 'cancel':
      return {
        title: 'Request cancelled',
        body: withReason(
          `${ref}: cancelled by the ${actor.role === 'owner' ? 'shop' : 'customer'}.`,
          input.reason.trim(),
        ),
      }
    default: {
      const unreachable: never = input
      return unreachable
    }
  }
}

/** Notifications for the other side of the conversation. The actor is never notified. */
export function notificationsFor(
  request: ServiceRequest,
  input: ActionInput,
  actor: Actor,
  ownerIds: readonly string[],
): NotificationDraft[] {
  const recipients = actor.role === 'owner' ? [request.customerId] : ownerIds
  const { title, body } = messageFor(request, input, actor)
  return recipients.filter((userId) => userId !== actor.id).map((userId) => ({ userId, title, body }))
}
