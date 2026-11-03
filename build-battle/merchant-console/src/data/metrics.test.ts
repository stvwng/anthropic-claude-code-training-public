import { afterEach, describe, expect, it } from "vitest"
import { headlineMetrics } from "./metrics"
import { store } from "./store"
import { PaymentStatus } from "./types"

/**
 * NWP-102 (S3): a refund-heavy merchant saw totals that were too high,
 * because gross volume added refunded payments back in. Gross volume has to
 * agree with what settles, and settlement (payouts) counts captured payments
 * only.
 */

const capturedTotal = () =>
  store.payments
    .filter((p) => p.status === "captured")
    .reduce((sum, p) => sum + p.amount, 0)

describe("headlineMetrics grossVolume", () => {
  const restore: { index: number; status: PaymentStatus }[] = []

  afterEach(() => {
    // The store is a process-wide singleton; put back anything a test changed.
    for (const { index, status } of restore.splice(0)) {
      store.payments[index].status = status
    }
  })

  it("equals the captured total, the same basis payouts settle on", () => {
    expect(headlineMetrics().grossVolume).toBe(capturedTotal())
  })

  it("goes down, not up, when a captured payment is refunded", () => {
    const index = store.payments.findIndex((p) => p.status === "captured")
    expect(index).toBeGreaterThanOrEqual(0)
    const payment = store.payments[index]
    const before = headlineMetrics().grossVolume

    restore.push({ index, status: payment.status })
    payment.status = "refunded"

    expect(headlineMetrics().grossVolume).toBe(before - payment.amount)
  })

  it("is an integer number of minor units", () => {
    expect(Number.isInteger(headlineMetrics().grossVolume)).toBe(true)
  })
})
