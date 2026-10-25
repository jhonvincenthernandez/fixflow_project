import { describe, expect, it } from 'vitest'
import { ConflictError, ForbiddenError, ValidationError } from '../src/domain/errors'
import {
  ACTION_IDS,
  ACTION_RULES,
  STAGES,
  actionOwner,
  applyAction,
  availableActions,
  isTerminal,
  notificationsFor,
  stageIndex,
} from '../src/domain/workflow'
import type { ActionInput } from '../src/domain/workflow'
import { STATUSES } from '../src/domain/types'
import type { ServiceRequest } from '../src/domain/types'
import { CUSTOMER, DRAFT, NOW, OTHER_CUSTOMER, OWNER, at, booking, makeAvailability, makeContext, makeRequest, withDay } from './helpers'

const context = makeContext()

function run(request: ServiceRequest, input: ActionInput, actor = OWNER, ctx = context): ServiceRequest {
  return applyAction(request, input, actor, ctx)
}

describe('stages', () => {
  it('lists the eight workflow stages in order', () => {
    expect(STAGES.map((stage) => stage.status)).toEqual([
      'requested',
      'under_review',
      'quotation_sent',
      'quotation_accepted',
      'scheduled',
      'in_progress',
      'completed',
      'feedback',
    ])
  })

  it('returns -1 for off-ramp statuses', () => {
    expect(stageIndex('declined')).toBe(-1)
    expect(stageIndex('cancelled')).toBe(-1)
    expect(stageIndex('scheduled')).toBe(4)
  })

  it('has an action owner for every status', () => {
    for (const status of STATUSES) {
      expect(actionOwner(status) === null).toBe(isTerminal(status))
    }
  })
})

describe('availableActions', () => {
  it('offers the customer accept, decline and cancel on a sent quotation', () => {
    expect(availableActions('quotation_sent', 'customer')).toEqual(['accept_quotation', 'decline_quotation', 'cancel'])
  })

  it('offers the owner the review step first', () => {
    expect(availableActions('requested', 'owner')).toEqual(['start_review', 'cancel'])
  })

  it('offers nothing on closed requests', () => {
    for (const status of ['feedback', 'declined', 'cancelled'] as const) {
      expect(availableActions(status, 'owner')).toEqual([])
      expect(availableActions(status, 'customer')).toEqual([])
    }
  })

  it('never lets an action target a status outside the enum', () => {
    for (const id of ACTION_IDS) {
      expect(STATUSES).toContain(ACTION_RULES[id].to)
    }
  })
})

describe('applyAction: happy path from request to feedback', () => {
  it('walks every stage and records history', () => {
    let request = makeRequest()
    request = run(request, { action: 'start_review' })
    expect(request.status).toBe('under_review')

    request = run(request, { action: 'send_quotation', draft: DRAFT })
    expect(request.status).toBe('quotation_sent')
    expect(request.quotation?.totalCentavos).toBe(230_000)

    request = run(request, { action: 'accept_quotation' }, CUSTOMER)
    expect(request.status).toBe('quotation_accepted')
    expect(request.quotation?.response).toBe('accepted')

    request = run(request, { action: 'schedule', startAt: at(6, 14) }, CUSTOMER)
    expect(request.status).toBe('scheduled')
    expect(request.appointment?.startAt).toBe(at(6, 14))

    request = run(request, { action: 'start_service' })
    request = run(request, { action: 'complete_service' })
    expect(request.status).toBe('completed')

    request = run(request, { action: 'submit_feedback', feedback: { rating: 5, comment: 'Fast and clean.' } }, CUSTOMER)
    expect(request.status).toBe('feedback')
    expect(request.feedback?.rating).toBe(5)
    expect(request.history.map((entry) => entry.status)).toEqual([
      'requested',
      'under_review',
      'quotation_sent',
      'quotation_accepted',
      'scheduled',
      'in_progress',
      'completed',
      'feedback',
    ])
  })

  it('does not mutate the input request', () => {
    const request = makeRequest()
    const snapshot = structuredClone(request)
    run(request, { action: 'start_review' })
    expect(request).toEqual(snapshot)
  })
})

describe('applyAction: guards', () => {
  it('rejects the wrong role', () => {
    expect(() => run(makeRequest(), { action: 'start_review' }, CUSTOMER)).toThrow(ForbiddenError)
  })

  it('rejects another customer', () => {
    expect(() => run(makeRequest(), { action: 'cancel', reason: '' }, OTHER_CUSTOMER)).toThrow(ForbiddenError)
  })

  it('rejects a transition from the wrong status', () => {
    expect(() => run(makeRequest(), { action: 'complete_service' })).toThrow(ConflictError)
  })

  it('rejects a stale second submission of the same action', () => {
    const reviewed = run(makeRequest(), { action: 'start_review' })
    expect(() => run(reviewed, { action: 'start_review' })).toThrow(ConflictError)
  })

  it('rejects acting on a closed request', () => {
    const cancelled = run(makeRequest(), { action: 'cancel', reason: 'Changed my mind' }, CUSTOMER)
    expect(() => run(cancelled, { action: 'start_review' })).toThrow(ConflictError)
  })
})

describe('applyAction: quotation', () => {
  const underReview = makeRequest({ status: 'under_review' })

  it('rejects an empty quotation', () => {
    expect(() => run(underReview, { action: 'send_quotation', draft: { ...DRAFT, items: [] } })).toThrow(ValidationError)
  })

  it('rejects a zero total', () => {
    const draft = { ...DRAFT, items: [{ description: 'Free check', quantity: 1, unitPriceCentavos: 0 }] }
    expect(() => run(underReview, { action: 'send_quotation', draft })).toThrow(ValidationError)
  })

  it('freezes validity from the send time', () => {
    const sent = run(underReview, { action: 'send_quotation', draft: DRAFT })
    expect(sent.quotation?.validUntil).toBe(NOW + 7 * 24 * 60 * 60 * 1000)
  })

  it('refuses to accept an expired quotation', () => {
    const sent = run(underReview, { action: 'send_quotation', draft: DRAFT })
    const later = makeContext({ now: NOW + 8 * 24 * 60 * 60 * 1000 })
    expect(() => run(sent, { action: 'accept_quotation' }, CUSTOMER, later)).toThrow(ConflictError)
  })

  it('records a decline with its reason and closes the request', () => {
    const sent = run(underReview, { action: 'send_quotation', draft: DRAFT })
    const declined = run(sent, { action: 'decline_quotation', reason: 'Too expensive' }, CUSTOMER)
    expect(declined.status).toBe('declined')
    expect(declined.closure).toEqual({ by: 'customer', reason: 'Too expensive' })
    expect(declined.quotation?.response).toBe('declined')
  })

  it('lets the owner withdraw a sent quotation for revision', () => {
    const sent = run(underReview, { action: 'send_quotation', draft: DRAFT })
    const revised = run(sent, { action: 'revise_quotation' })
    expect(revised.status).toBe('under_review')
    expect(revised.quotation).toBeNull()
  })
})

describe('applyAction: scheduling', () => {
  const accepted = makeRequest({ status: 'quotation_accepted' })

  it('rejects a slot that is full', () => {
    const full = makeContext({ bookings: [booking(6, 14), booking(6, 14)] })
    expect(() => run(accepted, { action: 'schedule', startAt: at(6, 14) }, CUSTOMER, full)).toThrow(ConflictError)
  })

  it('books the slot length the shop uses today', () => {
    const thirty = makeContext({ availability: makeAvailability({ slotMinutes: 30 }) })
    const scheduled = run(accepted, { action: 'schedule', startAt: at(6, 14) }, CUSTOMER, thirty)
    expect(scheduled.appointment?.durationMinutes).toBe(30)
  })

  it('rejects a time on a day the shop has closed', () => {
    const closed = makeContext({ availability: withDay(makeAvailability(), 2, { open: false }) })
    expect(() => run(accepted, { action: 'schedule', startAt: at(6, 14) }, CUSTOMER, closed)).toThrow(ValidationError)
  })

  it('allows rescheduling and notes it in history', () => {
    const scheduled = run(accepted, { action: 'schedule', startAt: at(6, 14) }, CUSTOMER)
    const moved = run(scheduled, { action: 'schedule', startAt: at(7, 9) }, OWNER)
    expect(moved.status).toBe('scheduled')
    expect(moved.appointment?.startAt).toBe(at(7, 9))
    expect(moved.appointment?.durationMinutes).toBe(60)
    expect(moved.history[moved.history.length - 1]?.note).toBe('Rescheduled')
  })
})

describe('applyAction: feedback and cancel', () => {
  it('rejects feedback without a rating', () => {
    const completed = makeRequest({ status: 'completed' })
    expect(() => run(completed, { action: 'submit_feedback', feedback: { rating: 0, comment: '' } }, CUSTOMER)).toThrow(
      ValidationError,
    )
  })

  it('cannot cancel once work has started', () => {
    const inProgress = makeRequest({ status: 'in_progress' })
    expect(() => run(inProgress, { action: 'cancel', reason: '' }, CUSTOMER)).toThrow(ConflictError)
  })

  it('rejects an over-long reason', () => {
    expect(() => run(makeRequest(), { action: 'cancel', reason: 'x'.repeat(201) }, CUSTOMER)).toThrow(ValidationError)
  })
})

describe('notificationsFor', () => {
  const request = makeRequest()

  it('notifies the customer when the owner acts', () => {
    const drafts = notificationsFor(request, { action: 'start_review' }, OWNER, [OWNER.id])
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.userId).toBe(CUSTOMER.id)
    expect(drafts[0]?.body).toContain('FF-0001')
  })

  it('notifies every owner when the customer acts', () => {
    const drafts = notificationsFor(request, { action: 'cancel', reason: 'Fixed it myself' }, CUSTOMER, ['o1', 'o2'])
    expect(drafts.map((draft) => draft.userId)).toEqual(['o1', 'o2'])
    expect(drafts[0]?.body).toContain('Fixed it myself')
  })

  it('never notifies the actor', () => {
    expect(notificationsFor(request, { action: 'cancel', reason: '' }, OWNER, [OWNER.id]).map((d) => d.userId)).toEqual([
      CUSTOMER.id,
    ])
  })

  it('writes interface copy without em dashes', () => {
    const inputs: ActionInput[] = [
      { action: 'start_review' },
      { action: 'send_quotation', draft: DRAFT },
      { action: 'revise_quotation' },
      { action: 'accept_quotation' },
      { action: 'decline_quotation', reason: 'No' },
      { action: 'schedule', startAt: at(6, 14) },
      { action: 'start_service' },
      { action: 'complete_service' },
      { action: 'submit_feedback', feedback: { rating: 4, comment: '' } },
      { action: 'cancel', reason: 'No' },
    ]
    for (const input of inputs) {
      for (const draft of notificationsFor(request, input, OWNER, ['o1'])) {
        expect(`${draft.title} ${draft.body}`).not.toContain('—')
      }
    }
  })
})
