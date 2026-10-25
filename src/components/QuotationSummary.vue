<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, formatMoney } from '@/domain/format'
import { lineTotal } from '@/domain/quotation'
import type { Quotation } from '@/domain/types'

const props = defineProps<{ quotation: Quotation; now: number }>()

const expired = computed(() => props.quotation.response === null && props.now > props.quotation.validUntil)
</script>

<template>
  <div class="quote">
    <div class="quote__badges">
      <span v-if="quotation.response === 'accepted'" class="ff-badge ff-badge--success">Accepted</span>
      <span v-else-if="quotation.response === 'declined'" class="ff-badge ff-badge--danger">Declined</span>
      <span v-else-if="expired" class="ff-badge">Expired</span>
      <span v-else class="ff-badge ff-badge--brand">Awaiting response</span>
    </div>

    <table class="quote__table">
      <caption class="ff-sr-only">Quotation line items</caption>
      <thead class="ff-sr-only">
        <tr>
          <th scope="col">Item</th>
          <th scope="col">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in quotation.items" :key="item.id">
          <th scope="row" class="quote__item">
            {{ item.description }}
            <span class="ff-meta quote__detail">{{ item.quantity }} × {{ formatMoney(item.unitPriceCentavos) }}</span>
          </th>
          <td class="quote__amount">{{ formatMoney(lineTotal(item)) }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Total</th>
          <td class="quote__amount quote__total">{{ formatMoney(quotation.totalCentavos) }}</td>
        </tr>
      </tfoot>
    </table>

    <dl class="quote__facts">
      <div>
        <dt class="ff-meta">Estimated repair time</dt>
        <dd>{{ quotation.estimatedDays }} {{ quotation.estimatedDays === 1 ? 'day' : 'days' }}</dd>
      </div>
      <div>
        <dt class="ff-meta">Valid until</dt>
        <dd>{{ formatDate(quotation.validUntil) }}</dd>
      </div>
    </dl>

    <p v-if="quotation.notes.length > 0" class="quote__notes">{{ quotation.notes }}</p>
  </div>
</template>

<style scoped>
.quote {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.quote__table {
  width: 100%;
  border-collapse: collapse;
}

.quote__table th,
.quote__table td {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}

.quote__item {
  font-weight: var(--weight-semibold);
}

.quote__detail {
  display: block;
  font-weight: var(--weight-regular);
}

.quote__table .quote__amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.quote__table tfoot th,
.quote__table tfoot td {
  border-bottom: 0;
  padding-top: var(--space-3);
  font-size: var(--text-md);
  font-weight: var(--weight-extrabold);
}

.quote__facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin: 0;
}

.quote__facts dd {
  margin: 0;
  font-weight: var(--weight-semibold);
}

.quote__notes {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}
</style>
