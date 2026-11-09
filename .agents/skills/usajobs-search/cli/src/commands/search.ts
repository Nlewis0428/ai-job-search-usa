import { api, err, intFlag, toCard, type Flags, type Fmt, type JobCard } from "../helpers.ts"

function render(cards: JobCard[], fmt: Fmt, meta: object): string {
  if (fmt === "json") return JSON.stringify({ meta, results: cards }, null, 2)
  if (cards.length === 0) return "No results."
  if (fmt === "plain")
    return cards.map((c) => `${c.title}\n  ${c.company ?? "—"} · ${c.location ?? "—"} · ${c.date ?? "—"} (closes ${c.closes ?? "—"})\n  ${c.salary ?? ""} ${c.grade ?? ""}\n  id: ${c.id}\n  ${c.url}`).join("\n\n")
  const head = "ID".padEnd(10) + " " + "TITLE".padEnd(40) + " " + "AGENCY".padEnd(28) + " " + "LOCATION".padEnd(22) + " POSTED     CLOSES"
  return [head, "-".repeat(head.length), ...cards.map((c) =>
    `${c.id.padEnd(10)} ${c.title.slice(0, 40).padEnd(40)} ${(c.company ?? "—").slice(0, 28).padEnd(28)} ${(c.location ?? "—").slice(0, 22).padEnd(22)} ${(c.date ?? "—").padEnd(10)} ${c.closes ?? "—"}`)].join("\n")
}

export async function runSearch(flags: Flags, fmt: Fmt): Promise<number> {
  const p = new URLSearchParams()
  for (const name of ["query", "location"] as const) {
    if (flags[name] === undefined) continue
    if (typeof flags[name] !== "string" || !(flags[name] as string).trim()) return err(`--${name} requires a non-empty value`, "BAD_ARG")
  }
  if (typeof flags.query === "string") p.set("Keyword", flags.query.trim())
  if (typeof flags.location === "string") p.set("LocationName", flags.location.trim())
  if (flags.remote !== undefined) {
    if (flags.remote !== true) return err("--remote takes no value", "BAD_ARG")
    p.set("RemoteIndicator", "True")
  }
  if (flags.jobage !== undefined) {
    const v = intFlag("jobage", flags.jobage, 1, 60)
    if (typeof v === "string") return err(v, "BAD_ARG")
    p.set("DatePosted", String(v))
  }
  if (flags.who !== undefined) {
    const map: Record<string, string> = { all: "All", public: "Public", status: "Status" }
    const w = typeof flags.who === "string" ? map[flags.who.toLowerCase()] : undefined
    if (!w) return err(`--who must be all|public|status, got "${flags.who}"`, "BAD_ARG")
    p.set("WhoMayApply", w)
  }
  const page = flags.page === undefined ? 1 : intFlag("page", flags.page, 1, 1000)
  if (typeof page === "string") return err(page, "BAD_ARG")
  const limit = flags.limit === undefined ? 25 : intFlag("limit", flags.limit, 1, 100)
  if (typeof limit === "string") return err(limit, "BAD_ARG")
  p.set("Page", String(page)); p.set("ResultsPerPage", String(limit))
  p.set("SortField", "opendate"); p.set("SortDirection", "Desc")
  const data = await api(p)
  const cards = (data?.SearchResult?.SearchResultItems ?? []).map(toCard)
  const total = Number(data?.SearchResult?.SearchResultCountAll ?? cards.length)
  process.stdout.write(render(cards, fmt, { count: cards.length, total, page }) + "\n")
  return 0
}
