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

export type ParsedExportScope =
  | { ok: true; scope: ExportScope }
  | { ok: false; error: string }

function isExportScope(value: string): value is ExportScope {
  return (EXPORT_SCOPES as readonly string[]).includes(value)
}

/** Absent means the current filter. Unknown is rejected, same as an unknown column. */
export function parseExportScope(raw: string | null): ParsedExportScope {
  if (raw === null) return { ok: true, scope: "filtered" }
  if (!isExportScope(raw)) {
    return { ok: false, error: `Unknown export scope: ${raw}` }
  }
  return { ok: true, scope: raw }
}

// Sort order is a view preference, not a filter, so "all payments" keeps it.
const SCOPE_INDEPENDENT_PARAMS = ["sort", "direction"] as const

/**
 * The params to hand to parseFilters for a given scope. "all" drops every
 * filter but keeps the sort, so the file comes out in the order on screen.
 */
export function scopedFilterParams(
  scope: ExportScope,
  params: URLSearchParams,
): URLSearchParams {
  if (scope === "filtered") return new URLSearchParams(params)

  const kept = new URLSearchParams()
  for (const key of SCOPE_INDEPENDENT_PARAMS) {
    const value = params.get(key)
    if (value !== null) kept.set(key, value)
  }
  return kept
}

// Spreadsheets run a cell starting with one of these as a formula. Merchants
// open these files in Excel, so free text gets an apostrophe to force text.
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/

function neutraliseFormula(value: string): string {
  return FORMULA_TRIGGERS.test(value) ? `'${value}` : value
}

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    // Only free-text columns are guarded: the rest are generated values, and a
    // negative amount like "-$5.00" must stay as written.
    case "merchant":
      return neutraliseFormula(
        merchantById(payment.merchantId)?.name ?? payment.merchantId,
      )
    case "description":
      return neutraliseFormula(payment.description)
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

/**
 * Defaults to the merchant-safe columns, so a caller that forgets to pass a
 * list cannot ship card last four by accident. Pass EXPORT_COLUMNS for all.
 */
export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = DEFAULT_EXPORT_COLUMNS,
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
