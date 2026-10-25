/**
 * Tunables for the data layer. Tests lower the iteration count so hashing stays fast.
 *
 * ASSUMPTION: FixFlow has no backend. Accounts and requests live in this device's
 * IndexedDB, so password hashing protects against casual inspection of the stored
 * data, not against someone with full control of the device.
 */
export const dataConfig = {
  passwordIterations: 210_000,
  maxImageBytes: 5 * 1024 * 1024,
}
