import type { ServiceId } from './types'

/** How careful the customer should be before the shop inspects the item. */
export type DiagnosisSafety = 'standard' | 'caution' | 'urgent'

/** The three answers the quick check collects. */
export type DiagnosisUrgency = 'can_wait' | 'daily_use' | 'safety'

export interface DiagnosisSymptom {
  readonly id: string
  readonly label: string
  readonly hint: string
  readonly likelyCause: string
  readonly safeStep: string
  readonly safety: DiagnosisSafety
  readonly safetyNote: string
  readonly requestSummary: string
}

export interface DiagnosisResult {
  readonly serviceId: ServiceId
  readonly symptom: DiagnosisSymptom
  readonly urgency: DiagnosisUrgency
  readonly safety: DiagnosisSafety
  readonly safetyNote: string
  readonly nextStep: string
  readonly requestDescription: string
}

export interface RequestDraft {
  readonly description: string
}

export const URGENCY_OPTIONS = [
  {
    value: 'can_wait',
    label: 'I can wait a few days',
    hint: 'Best for a problem that does not affect daily use.',
  },
  {
    value: 'daily_use',
    label: 'It affects daily use',
    hint: 'The shop should see it as soon as possible.',
  },
  {
    value: 'safety',
    label: 'I am worried about safety',
    hint: 'For heat, smoke, sparks, or a swollen battery.',
  },
] as const satisfies readonly { value: DiagnosisUrgency; label: string; hint: string }[]

const SAFETY_ESCALATION =
  'Stop using the item if it feels unsafe and book a priority check. The shop will confirm the fault after inspection.'

const URGENCY_SENTENCE: Record<DiagnosisUrgency, string> = {
  can_wait: 'I can wait a few days for the repair.',
  daily_use: 'This affects my daily use, so I would like the earliest available slot.',
  safety: 'I am worried about safety and would like a priority check.',
}

const SYMPTOMS: Record<ServiceId, readonly DiagnosisSymptom[]> = {
  phone: [
    {
      id: 'screen_cracked',
      label: 'Cracked or damaged screen',
      hint: 'Cracks, black patches, or touch that does not respond.',
      likelyCause: 'The glass or the display panel is damaged.',
      safeStep:
        'Keep the device away from water and avoid pressing on the cracked area. Back up your data if the screen still responds.',
      safety: 'standard',
      safetyNote: '',
      requestSummary: 'The phone screen is cracked or the display is damaged.',
    },
    {
      id: 'not_charging',
      label: 'Will not charge',
      hint: 'The cable is connected but the battery does not go up.',
      likelyCause: 'The charging port, cable, or battery may be faulty.',
      safeStep:
        'Try a known working cable and charger. Do not force the cable into the port or use a damaged cable.',
      safety: 'standard',
      safetyNote: '',
      requestSummary: 'The phone will not charge with a working cable and charger.',
    },
    {
      id: 'swollen_battery',
      label: 'Battery looks swollen',
      hint: 'The back cover is lifting, or the screen is pushing out.',
      likelyCause: 'The battery has failed and may be unsafe.',
      safeStep:
        'Keep the device off and away from heat. Do not press the screen or puncture the battery.',
      safety: 'urgent',
      safetyNote:
        'A swollen battery can catch fire. Stop using the device and bring it to the shop as soon as possible.',
      requestSummary: 'The phone battery looks swollen and the screen or back cover may be lifting.',
    },
  ],
  computer: [
    {
      id: 'slow',
      label: 'Very slow',
      hint: 'It takes a long time to start or open apps.',
      likelyCause: 'The storage may be failing, or the system may be low on space or memory.',
      safeStep:
        'Back up important files and close apps you do not need. Do not open the case yourself.',
      safety: 'standard',
      safetyNote: '',
      requestSummary: 'The laptop or desktop is much slower than usual, even after a restart.',
    },
    {
      id: 'will_not_boot',
      label: 'Will not start',
      hint: 'No display, no startup sound, or it stops at a logo.',
      likelyCause: 'The power supply, storage, or startup files may have failed.',
      safeStep:
        'Check the power cable and outlet. Do not open the case. If you hear clicking or smell burning, unplug it.',
      safety: 'caution',
      safetyNote: 'If you hear clicking from the drive or smell burning, stop using it and unplug it.',
      requestSummary: 'The laptop or desktop will not start or show anything on the screen.',
    },
    {
      id: 'overheating',
      label: 'Overheating',
      hint: 'The fan is loud, or the case gets very hot.',
      likelyCause: 'The vents may be blocked, or the cooling system may need service.',
      safeStep:
        'Keep it on a hard surface with clear vents. Back up your files and stop using it if it is too hot to touch.',
      safety: 'caution',
      safetyNote: 'Stop using it if it is too hot to touch or smells like burning. Do not open the case.',
      requestSummary: 'The laptop or desktop becomes very hot during normal use.',
    },
  ],
  appliance: [
    {
      id: 'not_cooling',
      label: 'Not cooling',
      hint: 'The air conditioner or refrigerator runs but stays warm.',
      likelyCause: 'The filter, fan, or cooling system may need service.',
      safeStep:
        'Clean the accessible filter if the manual allows it. Keep the area around the unit clear.',
      safety: 'standard',
      safetyNote: '',
      requestSummary: 'The appliance runs but does not cool properly.',
    },
    {
      id: 'leaking',
      label: 'Leaking water',
      hint: 'Water appears under or around the unit.',
      likelyCause: 'A hose, seal, or drain line may be blocked or damaged.',
      safeStep:
        'Unplug the unit and turn off the water supply if you can do so safely. Do not use it until it is checked.',
      safety: 'caution',
      safetyNote:
        'Water and electricity are unsafe together. Unplug the unit and turn off the water supply if you can do so safely.',
      requestSummary: 'The appliance is leaking water during use.',
    },
    {
      id: 'will_not_start',
      label: 'Will not start',
      hint: 'No power, no response, or it stops by itself.',
      likelyCause: 'The power supply, control board, or a safety switch may be faulty.',
      safeStep: 'Check that the plug and outlet are working. Do not open the unit.',
      safety: 'standard',
      safetyNote: '',
      requestSummary: 'The appliance will not start or turns off by itself.',
    },
  ],
  tv_audio: [
    {
      id: 'no_picture',
      label: 'No picture',
      hint: 'The screen stays black but the TV has power.',
      likelyCause: 'The display panel, backlight, or video input may be faulty.',
      safeStep:
        'Check the input source and cables. Do not open the TV or press on the screen.',
      safety: 'standard',
      safetyNote: '',
      requestSummary: 'The TV screen stays black even though the TV has power.',
    },
    {
      id: 'no_sound',
      label: 'No sound',
      hint: 'The picture works but there is no audio.',
      likelyCause: 'The speaker, audio settings, or sound board may be faulty.',
      safeStep: 'Check the volume and mute settings, then try another input. Do not open the TV.',
      safety: 'standard',
      safetyNote: '',
      requestSummary: 'The TV has a picture but no sound.',
    },
    {
      id: 'remote',
      label: 'Remote not working',
      hint: 'New batteries do not fix it.',
      likelyCause: 'The remote, its sensor, or the pairing may be faulty.',
      safeStep:
        'Try new batteries and point the remote directly at the TV. Check the manual for pairing steps.',
      safety: 'standard',
      safetyNote: '',
      requestSummary: 'The TV remote does not respond even with new batteries.',
    },
  ],
  electrical: [
    {
      id: 'sparking',
      label: 'Outlet sparked',
      hint: 'A spark, popping sound, or burning smell came from an outlet.',
      likelyCause: 'The outlet or wiring may be loose or damaged.',
      safeStep:
        'Stop using the outlet and switch off the breaker if you can do so safely. Do not open the outlet or panel yourself.',
      safety: 'urgent',
      safetyNote:
        'Sparks and burning smells can start a fire. Stop using the outlet and book a priority check.',
      requestSummary: 'An outlet sparked or made a popping sound when I plugged something in.',
    },
    {
      id: 'breaker',
      label: 'Breaker keeps tripping',
      hint: 'Power cuts out when you use a certain outlet or appliance.',
      likelyCause: 'The circuit may be overloaded, or an appliance may have a fault.',
      safeStep:
        'Unplug the appliance on that circuit and do not keep resetting the breaker. Do not open the panel yourself.',
      safety: 'caution',
      safetyNote:
        'If the breaker will not stay on, book a priority check. Do not open the panel yourself.',
      requestSummary: 'The breaker trips when I use a certain outlet or appliance.',
    },
    {
      id: 'flicker',
      label: 'Lights flicker',
      hint: 'Lights dim or flicker when an appliance turns on.',
      likelyCause: 'The circuit may be overloaded, or a connection may be loose.',
      safeStep:
        'Turn off the appliance on that circuit and do not open the outlet or panel yourself.',
      safety: 'caution',
      safetyNote:
        'If lights flicker across the whole home or you smell burning, stop using the circuit and book a priority check.',
      requestSummary: 'The lights flicker or dim when an appliance turns on.',
    },
  ],
  other: [
    {
      id: 'noise',
      label: 'Unusual noise',
      hint: 'A grinding, rattling, or buzzing sound.',
      likelyCause: 'A moving part or connection may be loose or worn.',
      safeStep:
        'Stop using the item if the noise is loud or comes with a burning smell. Do not open it yourself.',
      safety: 'standard',
      safetyNote: '',
      requestSummary: 'The item makes an unusual noise during use.',
    },
    {
      id: 'physical_damage',
      label: 'Physical damage',
      hint: 'A crack, dent, or broken part.',
      likelyCause: 'The damaged part may affect safety or performance.',
      safeStep: 'Stop using the item if it feels unstable or exposes wires.',
      safety: 'caution',
      safetyNote:
        'Do not try to repair it yourself. The shop will check whether it is safe to use.',
      requestSummary: 'The item has physical damage and may not be safe to use.',
    },
    {
      id: 'not_sure',
      label: 'Not sure what is wrong',
      hint: 'Describe what you see and the shop will check it.',
      likelyCause: 'The shop needs to inspect the item to identify the fault.',
      safeStep:
        'Take clear photos and note when the problem started. Stop using the item if it feels unsafe.',
      safety: 'standard',
      safetyNote: '',
      requestSummary: 'I am not sure what is wrong and would like the shop to check the item.',
    },
  ],
}

export function getSymptoms(serviceId: ServiceId): readonly DiagnosisSymptom[] {
  return SYMPTOMS[serviceId]
}

export function findSymptom(serviceId: ServiceId, symptomId: string | null): DiagnosisSymptom | null {
  if (symptomId === null) return null
  return getSymptoms(serviceId).find((symptom) => symptom.id === symptomId) ?? null
}

export function parseUrgency(value: unknown): DiagnosisUrgency | null {
  return value === 'can_wait' || value === 'daily_use' || value === 'safety' ? value : null
}

function nextStepFor(urgency: DiagnosisUrgency, safety: DiagnosisSafety): string {
  if (safety === 'urgent') return 'Book a priority check before using the item again.'
  if (urgency === 'daily_use') return 'Book the earliest available slot.'
  return 'Book a slot that fits your schedule.'
}

function safetyNoteFor(
  symptom: DiagnosisSymptom,
  urgency: DiagnosisUrgency,
  safety: DiagnosisSafety,
): string {
  if (safety === 'standard') return ''
  if (symptom.safetyNote.length > 0) return symptom.safetyNote
  return urgency === 'safety' ? SAFETY_ESCALATION : ''
}

export function diagnose(
  serviceId: ServiceId,
  symptomId: string | null,
  urgency: DiagnosisUrgency | null,
): DiagnosisResult | null {
  const symptom = findSymptom(serviceId, symptomId)
  if (symptom === null || urgency === null) return null

  const safety: DiagnosisSafety = urgency === 'safety' ? 'urgent' : symptom.safety
  return {
    serviceId,
    symptom,
    urgency,
    safety,
    safetyNote: safetyNoteFor(symptom, urgency, safety),
    nextStep: nextStepFor(urgency, safety),
    requestDescription: `${symptom.requestSummary} ${URGENCY_SENTENCE[urgency]}`,
  }
}

export function buildRequestDraft(
  serviceId: ServiceId,
  symptomId: string | null,
  urgency: DiagnosisUrgency | null,
): RequestDraft | null {
  const result = diagnose(serviceId, symptomId, urgency)
  if (result === null) return null
  return { description: result.requestDescription }
}

export function requestHref(
  serviceId: ServiceId,
  symptomId: string,
  urgency: DiagnosisUrgency,
): string {
  const params = new URLSearchParams({ service: serviceId, issue: symptomId, urgency })
  return `/request/new?${params.toString()}`
}
