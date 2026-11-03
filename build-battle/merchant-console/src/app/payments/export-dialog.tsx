"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  ExportScope,
  scopedFilterParams,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

type Counts =
  | { state: "idle" | "loading" }
  | { state: "ready"; filtered: number; all: number }
  | { state: "error"; message: string }

async function fetchTotal(query: string): Promise<number> {
  const response = await fetch(`/api/payments${query ? `?${query}` : ""}`)
  if (!response.ok) {
    throw new Error(`GET /api/payments returned ${response.status}`)
  }
  const body: { total: number } = await response.json()
  return body.total
}

/**
 * Export options for the payments table. `query` is the page's current filter
 * string; the server re-validates everything, so the checks here are only for
 * a usable form.
 */
export function ExportDialog({ query }: { query: string }) {
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("filtered")
  const [counts, setCounts] = useState<Counts>({ state: "idle" })

  // `page` is meaningless for an export and would only confuse the count.
  const filterQuery = (() => {
    const params = new URLSearchParams(query)
    params.delete("page")
    return params.toString()
  })()

  const loadCounts = async () => {
    setCounts({ state: "loading" })
    try {
      // Both counts come from GET /api/payments, the same query builder the export uses.
      const [filtered, all] = await Promise.all([
        fetchTotal(filterQuery),
        fetchTotal(""),
      ])
      setCounts({ state: "ready", filtered, all })
    } catch (error) {
      console.error(
        `[export] ${new Date().toISOString()} ExportDialog.loadCounts failed (filterQuery=${JSON.stringify(filterQuery)})`,
        error,
      )
      setCounts({ state: "error", message: "Couldn't load row counts." })
    }
  }

  const toggleColumn = (column: ExportColumn, checked: boolean) => {
    setColumns((current) => {
      const next = checked
        ? [...current, column]
        : current.filter((c) => c !== column)
      // Keep the file's column order stable regardless of click order.
      return EXPORT_COLUMNS.filter((c) => next.includes(c))
    })
  }

  const downloadHref = (() => {
    // Same helper as the route, so "all payments" keeps the sort on both sides.
    const params = scopedFilterParams(scope, new URLSearchParams(filterQuery))
    params.set("scope", scope)
    params.set("columns", columns.join(","))
    return `/api/payments/export?${params.toString()}`
  })()

  const rowCount =
    counts.state === "ready"
      ? scope === "all"
        ? counts.all
        : counts.filtered
      : null

  return (
    <Drawer
      onOpenChange={(open) => {
        if (open) void loadCounts()
      }}
    >
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes into the CSV before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["filtered", "Current filter"],
                  ["all", "All payments"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="export-scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="size-4 accent-blue-500"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p
              className="mt-2 text-sm text-gray-500"
              aria-live="polite"
            >
              {counts.state === "loading" && "Counting rows…"}
              {counts.state === "error" && counts.message}
              {rowCount !== null &&
                `${rowCount.toLocaleString()} ${rowCount === 1 ? "row" : "rows"} will be exported.`}
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={columns.includes(column)}
                    onChange={(event) =>
                      toggleColumn(column, event.target.checked)
                    }
                    className="size-4 accent-blue-500"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {columns.length === 0 && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-500">
                Select at least one column to export.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="gap-2">
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          {columns.length === 0 ? (
            <Button disabled className="w-full sm:w-fit">
              Download
            </Button>
          ) : (
            <Button asChild className="w-full sm:w-fit">
              <a href={downloadHref} download>
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
