import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names arrive from
 * the client, so they are parsed here against EXPORT_COLUMNS before anything
 * is written; the route never trusts the raw query string.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

// Last four is off by default: most exports go to merchants, and a file that
// leaks card digits to the wrong merchant is the near-miss NWP-101 exists for.
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ParsedExportColumns =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; error: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Parses the `columns` query param: comma-separated, order preserved,
 * duplicates dropped. Absent means the defaults; present but empty is an
 * error, because an export with no columns is never what anyone meant.
 */
export function parseExportColumns(raw: string | null): ParsedExportColumns {
  if (raw === null) return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)

  if (requested.length === 0) {
    return { ok: false, error: "Select at least one column to export." }
  }

  const unknown = requested.find((name) => !isExportColumn(name))
  if (unknown !== undefined) {
    // Rejecting rather than dropping: a silently missing column is worse than an error.
    return { ok: false, error: `Unknown export column: ${unknown}` }
  }

  return { ok: true, columns: [...new Set(requested as ExportColumn[])] }
}

export const EXPORT_SCOPES = ["filtered", "all"] as const
export type ExportScope = (typeof EXPORT_SCOPES)[number]

export function parseExportScope(raw: string | null): ExportScope {
  return raw === "all" ? "all" : "filtered"
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * `label` must already be allowlisted by the caller (a scope or a status);
 * it goes into a Content-Disposition header.
 */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}
