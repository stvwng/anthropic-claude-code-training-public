import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  ExportScope,
  parseExportColumns,
  parseExportScope,
  scopedFilterParams,
  toCsv,
} from "@/lib/csv"
import { PaymentFilters } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports payments as CSV with the columns and scope ops chose (NWP-101).
 *
 * Query params: the usual payment filters, plus
 *   columns  comma-separated, validated against EXPORT_COLUMNS (absent = defaults, no last4)
 *   scope    "filtered" (default) or "all"; anything else is a 400
 *
 * Every row comes from the one query builder; no pagination, so the file
 * holds every matching row rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const parsedColumns = parseExportColumns(params.get("columns"))
  if (!parsedColumns.ok) return reject("columns", params, parsedColumns.error)

  const parsedScope = parseExportScope(params.get("scope"))
  if (!parsedScope.ok) return reject("scope", params, parsedScope.error)
  const { scope } = parsedScope

  const filters = parseFilters(scopedFilterParams(scope, params))
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, parsedColumns.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), filenameLabel(scope, filters))}"`,
    },
  })
}

function reject(param: "columns" | "scope", params: URLSearchParams, error: string) {
  console.warn(
    `[export] ${new Date().toISOString()} GET /api/payments/export rejected ${param}=${JSON.stringify(params.get(param))}: ${error}`,
  )
  return NextResponse.json({ error }, { status: 400 })
}

/**
 * Only allowlisted values reach the filename: the scope itself, or a status
 * that parseFilters has already checked. merchantId and search never do.
 */
function filenameLabel(scope: ExportScope, filters: PaymentFilters): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  return "filtered"
}
