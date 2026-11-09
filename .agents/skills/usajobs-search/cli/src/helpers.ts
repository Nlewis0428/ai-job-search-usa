// Shared helpers for usajobs-cli: flag parsing, the USAJOBS API call, text cleaning,
// and mapping an API item to the search-output contract fields.

export const API = "https://data.usajobs.gov/api/search"

export type Fmt = "json" | "table" | "plain"
export interface Flags { _: string[]; [k: string]: string | boolean | string[] }

export function err(msg: string, code: string): number {
  process.stderr.write(JSON.stringify({ error: msg, code }) + "\n")
  return 1
}

export function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) flags[key] = true
      else { flags[key] = next; i++ }
    } else (flags._ as string[]).push(a)
  }
  return flags
}

export function intFlag(name: string, raw: unknown, min: number, max: number): number | string {
  const v = typeof raw === "string" ? Number(raw.trim()) : NaN
  if (!Number.isInteger(v) || v < min || v > max) return `--${name} must be a whole number from ${min} to ${max}, got "${raw}"`
  return v
}

// Remove zero-width, bidi and tag characters plus HTML so untrusted text cannot hide content.
const INVISIBLE = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]|[\u{E0000}-\u{E007F}]/gu
export function clean(s: unknown): string {
  if (typeof s !== "string") return ""
  return s
    .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(INVISIBLE, "")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

const isoDate = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null)

export async function api(params: URLSearchParams): Promise<any> {
  const key = process.env.USAJOBS_API_KEY?.trim()
  const email = process.env.USAJOBS_EMAIL?.trim()
  if (!key || !email) throw Object.assign(new Error("USAJOBS_API_KEY and USAJOBS_EMAIL env vars are required (free key: https://developer.usajobs.gov/apirequest)"), { code: "NO_API_KEY" })
  const url = `${API}?${params}`
  let delay = 1000
  for (let attempt = 0; attempt < 4; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 20000)
    try {
      const r = await fetch(url, {
        headers: { Host: "data.usajobs.gov", "User-Agent": email, "Authorization-Key": key, Accept: "application/json" },
        signal: ctrl.signal,
      })
      if (r.status === 401 || r.status === 403) throw Object.assign(new Error(`USAJOBS rejected the API key (HTTP ${r.status}); check USAJOBS_API_KEY and that USAJOBS_EMAIL matches the address the key was issued to`), { code: "AUTH" })
      if ((r.status === 429 || r.status >= 500) && attempt < 3) { await Bun.sleep(delay); delay *= 2; continue }
      if (!r.ok) throw Object.assign(new Error(`USAJOBS HTTP ${r.status}`), { code: "HTTP" })
      return await r.json()
    } finally { clearTimeout(t) }
  }
  throw Object.assign(new Error("USAJOBS retries exhausted"), { code: "HTTP" })
}

function pay(d: any): string | null {
  const r = d?.PositionRemuneration?.[0]
  if (!r) return null
  const min = Number(r.MinimumRange), max = Number(r.MaximumRange)
  const f = (n: number) => (Number.isFinite(n) ? "$" + Math.round(n).toLocaleString("en-US") : "?")
  const per = r.Description || r.RateIntervalCode || ""
  return `${f(min)} - ${f(max)}${per ? " " + per : ""}`
}

export interface JobCard {
  id: string; title: string; company: string | null; location: string | null; date: string | null
  closes: string | null; salary: string | null; grade: string | null; remote: boolean | null
  telework: boolean | null; who_may_apply: string | null; url: string
}

export function toCard(item: any): JobCard {
  const d = item?.MatchedObjectDescriptor ?? {}
  const ua = d?.UserArea?.Details ?? {}
  const agency = [d.OrganizationName, d.DepartmentName].filter(Boolean).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(" - ")
  return {
    id: String(item?.MatchedObjectId ?? d.PositionID ?? ""),
    title: clean(d.PositionTitle),
    company: clean(agency) || null,
    location: clean(d.PositionLocationDisplay) || null,
    date: isoDate(d.PublicationStartDate),
    closes: isoDate(d.ApplicationCloseDate),
    salary: pay(d),
    grade: ua.LowGrade ? `${d?.JobGrade?.[0]?.Code ?? ""}-${ua.LowGrade}${ua.HighGrade && ua.HighGrade !== ua.LowGrade ? "/" + ua.HighGrade : ""}` : null,
    remote: typeof ua.RemoteIndicator === "boolean" ? ua.RemoteIndicator : null,
    telework: typeof ua.TeleworkEligible === "boolean" ? ua.TeleworkEligible : null,
    who_may_apply: clean(ua?.WhoMayApply?.Name) || null,
    url: typeof d.PositionURI === "string" ? d.PositionURI.replace(":443/", "/") : `https://www.usajobs.gov/job/${item?.MatchedObjectId ?? ""}`,
  }
}
