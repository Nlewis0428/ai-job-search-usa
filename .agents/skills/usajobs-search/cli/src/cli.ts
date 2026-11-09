#!/usr/bin/env bun
// usajobs-cli: search U.S. federal postings through the official USAJOBS Search API.
// Zero runtime dependencies. Requires a free API key (https://developer.usajobs.gov/apirequest)
// supplied as env vars USAJOBS_API_KEY and USAJOBS_EMAIL (the email the key was issued to).

import { err, parseFlags, type Fmt } from "./helpers.ts"
import { runSearch } from "./commands/search.ts"
import { runDetail } from "./commands/detail.ts"

const HELP = `usajobs-cli — search U.S. federal jobs (official USAJOBS Search API)

SETUP
  Free key: https://developer.usajobs.gov/apirequest
  Set env vars USAJOBS_API_KEY and USAJOBS_EMAIL (Windows: setx USAJOBS_API_KEY "..." ; setx USAJOBS_EMAIL "...")

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>     Keywords (title, skill). Recommended.
  --location, -l <text>  City/state, e.g. "Charlotte, North Carolina". Omit for nationwide.
  --remote               Only remote positions (RemoteIndicator=True).
  --jobage <days>        Posted within N days (1-60).
  --who <who>            all | public | status. Default all.
  --page <n>             1-indexed page. Default 1.
  --limit, -n <n>        Results per page, 1-100. Default 25.
  --format <fmt>         json (default) | table | plain.
`

const KNOWN: Record<string, Set<string>> = {
  search: new Set(["query", "location", "remote", "jobage", "who", "page", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2))
  const cmd = flags._[0]
  if (!cmd || flags.help || flags.h) { process.stdout.write(HELP); return cmd ? 0 : 1 }
  const known = KNOWN[cmd]
  if (!known) return err(`unknown command '${cmd}' (use search or detail)`, "BAD_COMMAND")
  for (const k of Object.keys(flags)) if (k !== "_" && !known.has(k))
    return err(`unknown flag --${k} for '${cmd}' - flags are never silently ignored; see --help`, "UNKNOWN_FLAG")
  const fmt = (flags.format === undefined ? "json" : String(flags.format)) as Fmt
  if (!["json", "table", "plain"].includes(fmt)) return err(`--format must be json|table|plain, got "${fmt}"`, "BAD_ARG")
  try {
    return cmd === "search" ? await runSearch(flags, fmt) : await runDetail(flags, fmt)
  } catch (e: any) {
    return err(e?.message ?? String(e), e?.code ?? (cmd === "search" ? "SEARCH_FAILED" : "DETAIL_FAILED"))
  }
}

process.exit(await main())
