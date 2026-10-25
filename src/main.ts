import { createApp } from 'vue'
import { IonicVue } from '@ionic/vue'

import '@fontsource-variable/plus-jakarta-sans'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import './theme/global.css'
import './theme/variables.css'

import App from './App.vue'
import router from './router'
import { initAppearance } from './composables/useAppearance'
import { logger } from './domain/logger'

const root = document.getElementById('app')
if (!(root instanceof HTMLElement)) {
  throw new Error('Expected #app to exist in index.html')
}

initAppearance()

// 'md' gives Android and desktop browsers the same look, so the browser preview matches the APK.
const app = createApp(App).use(IonicVue, { mode: 'md' }).use(router)

app.config.errorHandler = (error, _instance, info) => {
  logger.error(`Unhandled Vue error (${info})`, error)
}

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', event.reason)
})

// Mount right away. App.vue shows a splash while the session loads, so first launch
// (which hashes the demo passwords) never leaves a blank screen.
app.mount(root)
