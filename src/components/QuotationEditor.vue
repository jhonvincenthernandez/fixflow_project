<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Trash2 } from '@lucide/vue'
import type { FieldErrors } from '@/domain/errors'
import { formatMoney } from '@/domain/format'
import { newId } from '@/domain/ids'
import { computeTotal, parsePesos } from '@/domain/quotation'
import type { QuotationDraft } from '@/domain/types'
import AppButton from './AppButton.vue'
import FormField from './FormField.vue'

const MAX_LINES = 20
const WHOLE_NUMBER = /^\d{1,3}$/

const props = defineProps<{
  formId: string
  /** Errors reported by the domain layer after a submit attempt, keyed by field path. */
  errors: FieldErrors
}>()

const emit = defineEmits<{ submit: [draft: QuotationDraft] }>()

interface Row {
  key: string
  description: string
  quantity: string
  price: string
}

function newRow(): Row {
  return { key: newId(), description: '', quantity: '1', price: '' }
}

const rows = ref<Row[]>([newRow()])
const notes = ref('')
const estimatedDays = ref('1')
const validDays = ref('7')
const localErrors = ref<FieldErrors>({})

function errorFor(path: string): string | undefined {
  return localErrors.value[path]?.[0] ?? props.errors[path]?.[0]
}

/** Live total from every row that currently parses. Invalid rows count as zero. */
const total = computed(() =>
  computeTotal(
    rows.value.map((row) => ({
      quantity: WHOLE_NUMBER.test(row.quantity.trim()) ? Number(row.quantity) : 0,
      unitPriceCentavos: parsePesos(row.price) ?? 0,
    })),
  ),
)

function addRow(): void {
  if (rows.value.length < MAX_LINES) rows.value = [...rows.value, newRow()]
}

function removeRow(index: number): void {
  rows.value = rows.value.filter((_, position) => position !== index)
}

function onSubmit(): void {
  const errors: FieldErrors = {}

  const items = rows.value.map((row, index) => {
    const price = parsePesos(row.price)
    if (price === null) errors[`items.${index}.unitPriceCentavos`] = ['Enter a price like 1250 or 1250.50']
    const quantityText = row.quantity.trim()
    if (!WHOLE_NUMBER.test(quantityText)) errors[`items.${index}.quantity`] = ['Use a whole number']
    return {
      description: row.description,
      quantity: WHOLE_NUMBER.test(quantityText) ? Number(quantityText) : 0,
      unitPriceCentavos: price ?? 0,
    }
  })

  if (!WHOLE_NUMBER.test(estimatedDays.value.trim())) errors['estimatedDays'] = ['Use a whole number of days']
  if (!WHOLE_NUMBER.test(validDays.value.trim())) errors['validDays'] = ['Use a whole number of days']

  localErrors.value = errors
  if (Object.keys(errors).length > 0) return

  emit('submit', {
    items,
    notes: notes.value,
    estimatedDays: Number(estimatedDays.value.trim()),
    validDays: Number(validDays.value.trim()),
  })
}
</script>

<template>
  <form :id="formId" class="ff-stack" novalidate @submit.prevent="onSubmit">
    <fieldset v-for="(row, index) in rows" :key="row.key" class="ff-inset line">
      <legend class="ff-overline line__legend">Line {{ index + 1 }}</legend>

      <FormField v-slot="field" label="Description" :error="errorFor(`items.${index}.description`)">
        <input
          :id="field.id"
          v-model="row.description"
          class="ff-input"
          type="text"
          maxlength="80"
          autocomplete="off"
          placeholder="Replacement battery"
          :aria-invalid="field.invalid"
          :aria-describedby="field.describedBy"
        />
      </FormField>

      <div class="line__numbers">
        <FormField v-slot="field" label="Quantity" :error="errorFor(`items.${index}.quantity`)">
          <input
            :id="field.id"
            v-model="row.quantity"
            class="ff-input"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedBy"
          />
        </FormField>
        <FormField v-slot="field" label="Unit price (PHP)" :error="errorFor(`items.${index}.unitPriceCentavos`)">
          <input
            :id="field.id"
            v-model="row.price"
            class="ff-input"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="1250.00"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedBy"
          />
        </FormField>
      </div>

      <AppButton v-if="rows.length > 1" variant="ghost" @click="removeRow(index)">
        <Trash2 class="ff-icon ff-icon--sm" aria-hidden="true" />
        Remove line {{ index + 1 }}
      </AppButton>
    </fieldset>

    <p v-if="errorFor('items')" class="ff-error-text" role="alert">{{ errorFor('items') }}</p>

    <AppButton variant="secondary" :disabled="rows.length >= MAX_LINES" @click="addRow">
      <Plus class="ff-icon ff-icon--sm" aria-hidden="true" />
      Add line item
    </AppButton>

    <div class="line__numbers">
      <FormField v-slot="field" label="Repair time (days)" :error="errorFor('estimatedDays')">
        <input
          :id="field.id"
          v-model="estimatedDays"
          class="ff-input"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :aria-invalid="field.invalid"
          :aria-describedby="field.describedBy"
        />
      </FormField>
      <FormField v-slot="field" label="Valid for (days)" :error="errorFor('validDays')">
        <input
          :id="field.id"
          v-model="validDays"
          class="ff-input"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :aria-invalid="field.invalid"
          :aria-describedby="field.describedBy"
        />
      </FormField>
    </div>

    <FormField v-slot="field" label="Notes for the customer" optional :error="errorFor('notes')">
      <textarea
        :id="field.id"
        v-model="notes"
        class="ff-textarea"
        maxlength="500"
        placeholder="Warranty, pickup details, anything the customer should know"
        :aria-invalid="field.invalid"
        :aria-describedby="field.describedBy"
      />
    </FormField>

    <p class="total" aria-live="polite">
      <span>Total</span>
      <strong>{{ formatMoney(total) }}</strong>
    </p>
  </form>
</template>

<style scoped>
.line {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
  margin: 0;
}

.line__legend {
  padding: 0 var(--space-1);
}

.line__numbers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
  font-size: var(--text-md);
}

.total strong {
  font-size: var(--text-xl);
  font-weight: var(--weight-extrabold);
  font-variant-numeric: tabular-nums;
}
</style>
