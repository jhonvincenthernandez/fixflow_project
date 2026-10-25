import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import { ensureSession, getSessionState } from '@/composables/useSession'
import type { Role } from '@/domain/types'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    /** Only this role may open the route. */
    role?: Role
  }
}

// Public landing page for signed-out visitors; the guard sends signed-in users home.
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/views/LandingPage.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/auth',
    component: () => import('@/views/AuthPage.vue'),
    meta: { guestOnly: true },
  },
  {
    // Public on purpose: visitors can check a problem before they create an account.
    path: '/diagnose',
    component: () => import('@/views/DiagnosePage.vue'),
  },
  {
    path: '/tabs/',
    component: () => import('@/views/TabsPage.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/tabs/home' },
      { path: 'home', component: () => import('@/views/HomePage.vue') },
      { path: 'requests', component: () => import('@/views/RequestsPage.vue') },
      { path: 'alerts', component: () => import('@/views/AlertsPage.vue') },
      { path: 'profile', component: () => import('@/views/ProfilePage.vue') },
    ],
  },
  {
    path: '/request/new',
    component: () => import('@/views/NewRequestPage.vue'),
    meta: { requiresAuth: true, role: 'customer' },
  },
  {
    path: '/availability',
    component: () => import('@/views/AvailabilityPage.vue'),
    meta: { requiresAuth: true, role: 'owner' },
  },
  {
    path: '/request/:id',
    component: () => import('@/views/RequestDetailPage.vue'),
    meta: { requiresAuth: true },
    // Props instead of useRoute(): Ionic keeps old pages mounted, and useRoute() would follow the new page.
    props: true,
  },
  { path: '/:pathMatch(.*)*', component: () => import('@/views/NotFoundPage.vue') },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to: RouteLocationNormalized) => {
  await ensureSession()
  const session = getSessionState()

  // A failed start is shown by App.vue with a retry button, so let navigation continue.
  if (session.status === 'error') return true

  const signedIn = session.status === 'signedIn'
  if (to.meta.requiresAuth === true && !signedIn) {
    return { path: '/auth', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly === true && signedIn) return '/tabs/home'
  if (to.meta.role !== undefined && session.status === 'signedIn' && session.user.role !== to.meta.role) {
    return '/tabs/home'
  }
  return true
})

export default router
