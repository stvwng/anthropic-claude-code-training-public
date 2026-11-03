import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  ExportScope,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { PaymentFilters } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports payments as CSV with the columns and scope ops chose (NWP-101).
 *
 * Query params: the usual payment filters, plus
 *   columns  comma-separated, validated against EXPORT_COLUMNS (absent = defaults, no last4)
 *   scope    "filtered" (default) or "all"
 *
 * Every row comes from the one query builder; no pagination, so the file
 * holds every matching row rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const parsedColumns = parseExportColumns(params.get("columns"))
  if (!parsedColumns.ok) {
    console.warn(
      `[export] ${new Date().toISOString()} rejected columns=${JSON.stringify(params.get("columns"))}: ${parsedColumns.error}`,
    )
    return NextResponse.json({ error: parsedColumns.error }, { status: 400 })
  }

  const scope = parseExportScope(params.get("scope"))
  // "all" still goes through parseFilters, just with nothing to filter on.
  const filters =
    scope === "all" ? parseFilters(new URLSearchParams()) : parseFilters(params)

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

/**
 * Only allowlisted values reach the filename: the scope itself, or a status
 * that parseFilters has already checked. merchantId and search never do.
 */
function filenameLabel(scope: ExportScope, filters: PaymentFilters): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  return "filtered"
}
