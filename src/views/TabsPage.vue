<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { IonLabel, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue'
import { Bell, ClipboardList, House, User } from '@lucide/vue'
import { useNotifications } from '@/composables/useNotifications'
import { useSession } from '@/composables/useSession'

interface TabItem {
  readonly tab: string
  readonly href: string
  readonly label: string
  readonly icon: Component
}

const { role } = useSession()
const { unreadCount } = useNotifications()

const tabs = computed<TabItem[]>(() => [
  { tab: 'home', href: '/tabs/home', label: role.value === 'owner' ? 'Dashboard' : 'Home', icon: House },
  { tab: 'requests', href: '/tabs/requests', label: 'Requests', icon: ClipboardList },
  { tab: 'alerts', href: '/tabs/alerts', label: 'Alerts', icon: Bell },
  { tab: 'profile', href: '/tabs/profile', label: 'Profile', icon: User },
])

const badgeText = computed(() => (unreadCount.value > 9 ? '9+' : String(unreadCount.value)))
</script>

<template>
  <!-- Ionic Vue needs an <ion-page> root on every routed view, including the one that hosts the tabs. -->
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom" aria-label="Main navigation">
        <ion-tab-button v-for="item in tabs" :key="item.tab" :tab="item.tab" :href="item.href">
          <component :is="item.icon" class="ff-icon" aria-hidden="true" />
          <ion-label>
            {{ item.label }}
            <span v-if="item.tab === 'alerts' && unreadCount > 0" class="ff-sr-only">, {{ unreadCount }} unread</span>
          </ion-label>
          <span v-if="item.tab === 'alerts' && unreadCount > 0" class="tab-badge" aria-hidden="true">{{ badgeText }}</span>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<style scoped>
.tab-badge {
  position: absolute;
  top: var(--space-1);
  left: calc(50% + var(--space-1));
  min-width: var(--icon-md);
  padding: 0 var(--space-1);
  background: var(--color-brand);
  border: 2px solid var(--color-surface);
  border-radius: var(--radius-full);
  color: var(--color-text-on-brand);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  line-height: var(--icon-sm);
  text-align: center;
}
</style>
