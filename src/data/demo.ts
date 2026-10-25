/**
 * Demo accounts created on first launch. FixFlow is a local prototype with no backend,
 * so these exist to let a reviewer try both sides of the workflow on one device.
 */
export const DEMO_PASSWORD = 'fixflow123'

export const DEMO_ACCOUNTS = {
  customer: { label: 'Customer', name: 'Ana Reyes', email: 'ana@fixflow.app', phone: '09171234567' },
  owner: { label: 'Business owner', name: 'Marco Villanueva', email: 'owner@fixflow.app', phone: '09189876543' },
  secondCustomer: { label: 'Customer', name: 'Ben Santos', email: 'ben@fixflow.app', phone: '09205550123' },
} as const
