<script setup lang="ts" generic="T extends number">
const props = defineProps<{
  choices: readonly { readonly value: T; readonly text: string }[]
  /** Pass the id from FormField so its label points at this control. */
  id?: string
  invalid?: boolean
  describedBy?: string | undefined
}>()

const model = defineModel<T>({ required: true })

function onChange(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) return
  const chosen = props.choices.find((choice) => String(choice.value) === target.value)
  if (chosen !== undefined) model.value = chosen.value
}
</script>

<template>
  <select
    :id="id"
    class="ff-select"
    :aria-invalid="invalid ? 'true' : undefined"
    :aria-describedby="describedBy"
    @change="onChange"
  >
    <option v-for="choice in choices" :key="choice.value" :value="choice.value" :selected="choice.value === model">
      {{ choice.text }}
    </option>
  </select>
</template>
