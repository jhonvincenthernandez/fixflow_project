import { z } from 'zod'
import { ValidationError } from './errors'
import type { FieldErrors } from './errors'

/* ------------------------------------------------------------
   Primitives
   ------------------------------------------------------------ */
const Id = z.string().min(1)
const Millis = z.number().int().nonnegative()

export const ROLES = ['customer', 'owner'] as const
export const RoleSchema = z.enum(ROLES)
export type Role = z.infer<typeof RoleSchema>

export const SERVICE_IDS = ['phone', 'computer', 'appliance', 'tv_audio', 'electrical', 'other'] as const
export const ServiceIdSchema = z.enum(SERVICE_IDS)
export type ServiceId = z.infer<typeof ServiceIdSchema>

/** The guide's workflow, plus two terminal off-ramps (declined, cancelled). */
export const STATUSES = [
  'requested',
  'under_review',
  'quotation_sent',
  'quotation_accepted',
  'scheduled',
  'in_progress',
  'completed',
  'feedback',
  'declined',
  'cancelled',
] as const
export const StatusSchema = z.enum(STATUSES)
export type RequestStatus = z.infer<typeof StatusSchema>

export const FULFILMENT_MODES = ['drop_off', 'home_visit'] as const
export const FulfilmentModeSchema = z.enum(FULFILMENT_MODES)
export type FulfilmentMode = z.infer<typeof FulfilmentModeSchema>

export const MAX_IMAGES = 4

/* ------------------------------------------------------------
   Persisted entities (parsed on read, so corrupted data fails loudly)
   ------------------------------------------------------------ */
export const UserSchema = z.object({
  id: Id,
  role: RoleSchema,
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  passwordHash: z.string(),
  salt: z.string(),
  iterations: z.number().int().positive(),
  createdAt: Millis,
})
export type User = z.infer<typeof UserSchema>
export type PublicUser = Omit<User, 'passwordHash' | 'salt' | 'iterations'>

export const LineItemSchema = z.object({
  id: Id,
  description: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCentavos: z.number().int().nonnegative(),
})
export type LineItem = z.infer<typeof LineItemSchema>

export const QuotationSchema = z.object({
  items: z.array(LineItemSchema),
  notes: z.string(),
  estimatedDays: z.number().int().positive(),
  validUntil: Millis,
  /** Frozen at send time so history never changes if pricing rules change later. */
  totalCentavos: z.number().int().nonnegative(),
  sentAt: Millis,
  response: z.enum(['accepted', 'declined']).nullable(),
  respondedAt: Millis.nullable(),
})
export type Quotation = z.infer<typeof QuotationSchema>

export const AppointmentSchema = z.object({
  startAt: Millis,
  /** The slot length when it was booked. Later changes to the shop's slot length do not alter it. */
  durationMinutes: z.number().int().positive().default(60),
  createdBy: RoleSchema,
  updatedAt: Millis,
})
export type Appointment = z.infer<typeof AppointmentSchema>

export const FeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  createdAt: Millis,
})
export type Feedback = z.infer<typeof FeedbackSchema>

export const HistoryEntrySchema = z.object({
  status: StatusSchema,
  at: Millis,
  by: RoleSchema,
  note: z.string(),
})
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>

export const ClosureSchema = z.object({
  by: RoleSchema,
  reason: z.string(),
})
export type Closure = z.infer<typeof ClosureSchema>

export const ServiceRequestSchema = z.object({
  id: Id,
  ref: z.string(),
  customerId: Id,
  serviceId: ServiceIdSchema,
  itemName: z.string(),
  description: z.string(),
  mode: FulfilmentModeSchema,
  address: z.string(),
  imageIds: z.array(Id),
  status: StatusSchema,
  quotation: QuotationSchema.nullable(),
  appointment: AppointmentSchema.nullable(),
  feedback: FeedbackSchema.nullable(),
  closure: ClosureSchema.nullable(),
  history: z.array(HistoryEntrySchema),
  createdAt: Millis,
  updatedAt: Millis,
})
export type ServiceRequest = z.infer<typeof ServiceRequestSchema>

export const NotificationSchema = z.object({
  id: Id,
  userId: Id,
  requestId: Id,
  title: z.string(),
  body: z.string(),
  createdAt: Millis,
  readAt: Millis.nullable(),
})
export type AppNotification = z.infer<typeof NotificationSchema>

/* ------------------------------------------------------------
   Form input schemas (messages are shown beside the failing field)
   ------------------------------------------------------------ */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PH_MOBILE_PATTERN = /^(?:\+63|63|0)9\d{9}$/

const EmailField = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .toLowerCase()
  .regex(EMAIL_PATTERN, 'Enter a valid email address')

export const LoginInputSchema = z.object({
  email: EmailField,
  password: z.string().min(1, 'Enter your password'),
})
export type LoginInput = z.infer<typeof LoginInputSchema>

export const RegisterInputSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(60, 'Keep your name under 60 characters'),
  email: EmailField,
  phone: z
    .string()
    .min(1, 'Enter your mobile number')
    .transform((value) => value.replace(/[\s()-]/g, ''))
    .refine((value) => PH_MOBILE_PATTERN.test(value), 'Enter a mobile number like 0917 123 4567'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(72, 'Keep your password under 72 characters'),
})
export type RegisterInput = z.infer<typeof RegisterInputSchema>

export const NewRequestInputSchema = z
  .object({
    serviceId: ServiceIdSchema,
    itemName: z.string().trim().min(2, 'Name the item that needs repair').max(60, 'Keep this under 60 characters'),
    description: z
      .string()
      .trim()
      .min(10, 'Describe the problem in at least 10 characters')
      .max(1000, 'Keep the description under 1000 characters'),
    mode: FulfilmentModeSchema,
    address: z.string().trim().max(200, 'Keep the address under 200 characters'),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'home_visit' && value.address.length < 8) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message: 'Enter the address for the home visit',
      })
    }
  })
export type NewRequestInput = z.infer<typeof NewRequestInputSchema>

export const QuotationDraftSchema = z.object({
  items: z
    .array(
      z.object({
        description: z.string().trim().min(2, 'Describe this line').max(80, 'Keep this under 80 characters'),
        quantity: z.number().int('Use a whole number').min(1, 'At least 1').max(99, 'At most 99'),
        unitPriceCentavos: z
          .number()
          .int('Enter a valid price')
          .min(0, 'Price cannot be negative')
          .max(100_000_000, 'Price is too large'),
      }),
    )
    .min(1, 'Add at least one line item')
    .max(20, 'Use at most 20 line items'),
  notes: z.string().trim().max(500, 'Keep notes under 500 characters'),
  estimatedDays: z.number().int('Use a whole number').min(1, 'At least 1 day').max(60, 'At most 60 days'),
  validDays: z.number().int('Use a whole number').min(1, 'At least 1 day').max(30, 'At most 30 days'),
})
export type QuotationDraft = z.infer<typeof QuotationDraftSchema>

export const FeedbackInputSchema = z.object({
  rating: z.number().int().min(1, 'Choose a star rating').max(5, 'Choose a star rating'),
  comment: z.string().trim().max(500, 'Keep your comment under 500 characters'),
})
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>

export const ReasonSchema = z.string().trim().max(200, 'Keep the reason under 200 characters')

/* ------------------------------------------------------------
   Parsing helper
   ------------------------------------------------------------ */
/** Maps zod issues to "field path -> messages", the shape forms show beside each field. */
function collectFieldErrors(issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[]): FieldErrors {
  const fields: FieldErrors = {}
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_form'
    const messages = fields[key] ?? []
    messages.push(issue.message)
    fields[key] = messages
  }
  return fields
}

/** Parses `value` or throws a ValidationError whose `fields` map paths to messages. */
export function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  throw new ValidationError(collectFieldErrors(result.error.issues))
}

/** The field errors `value` would produce, or an empty object when it is valid. For live form feedback. */
export function validationFields<S extends z.ZodType>(schema: S, value: unknown): FieldErrors {
  const result = schema.safeParse(value)
  return result.success ? {} : collectFieldErrors(result.error.issues)
}
