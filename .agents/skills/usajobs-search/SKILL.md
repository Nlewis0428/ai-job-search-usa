---
name: usajobs-search
version: 1.0.0
description: >
  Use this skill to search live U.S. federal government job postings (civilian
  agencies, DoD, VA, DHS, etc.) through the official USAJOBS Search API, or to fetch
  the full announcement for a specific USAJOBS posting. Covers GS/GG IT Specialist
  (INFOSEC), identity and access management, cybersecurity, and any other federal
  role, nationwide or remote. Trigger phrases: federal jobs, government jobs,
  USAJOBS, GS-2210, DoD civilian jobs, veteran preference jobs, "are there any
  federal X jobs in <place>", look up this usajobs.gov posting.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/usajobs-search/cli/src/cli.ts *)
---

# USAJOBS Search Skill

Searches **USAJOBS**, the official U.S. federal job board, via its documented public
Search API (`https://data.usajobs.gov/api/search`). This is a sanctioned API, not a
scraper. It needs a **free API key**.

## Setup (one time)

1. Request a key at https://developer.usajobs.gov/apirequest (it arrives by email).
2. Set two user environment variables, then open a new terminal:
   - Windows: `setx USAJOBS_API_KEY "<key>"` and `setx USAJOBS_EMAIL "<email the key was issued to>"`
   - macOS/Linux: export both in your shell profile.

Without them every command exits 1 with `{"code":"NO_API_KEY"}`. Treat that as a
setup gap, not a broken portal.

## Commands

### Search

```bash
bun run .agents/skills/usajobs-search/cli/src/cli.ts search [flags]
```

Query syntax: plain keywords (USAJOBS `Keyword`); phrase quoting and OR not verified - send one plain term per call.

- `--query <text>` / `-q` — keywords (title, skill, series such as `2210`). Recommended.
- `--location <text>` / `-l` — city/state, e.g. `"Charlotte, North Carolina"`. Omit for nationwide.
- `--remote` — only positions flagged remote (no value).
- `--jobage <days>` — posted within N days, 1-60.
- `--who <all|public|status>` — who may apply. Default all. `status` = current/former federal employees and some veteran hiring paths.
- `--page <n>` — 1-indexed page.
- `--limit <n>` / `-n` — results per page, 1-100 (default 25).
- `--format json|table|plain` — default `json`.

Results are sorted newest first. Each result carries `id`, `title`, `company`
(agency - department), `location`, `date` (posted, YYYY-MM-DD), `closes`, `salary`,
`grade`, `remote`, `telework`, `who_may_apply`, `url`.

### Detail

```bash
bun run .agents/skills/usajobs-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

Takes the numeric control number (`id` from search) or a `usajobs.gov/job/<id>` URL.
Returns summary, duties, qualifications, requirements, education, security
clearance, hiring paths, evaluation criteria and how to apply. Closed postings
return `NOT_FOUND`.

## Usage examples

```bash
bun run .agents/skills/usajobs-search/cli/src/cli.ts search -q "identity access management" --jobage 14 --format table
bun run .agents/skills/usajobs-search/cli/src/cli.ts search -q "IT Specialist INFOSEC" --remote --format table
bun run .agents/skills/usajobs-search/cli/src/cli.ts search -q "cybersecurity" -l "Charlotte, North Carolina" --jobage 30
bun run .agents/skills/usajobs-search/cli/src/cli.ts detail 812345600 --format plain
```

## Notes

- Federal postings have hard **closing dates**: surface `closes` and flag anything closing within 5 days.
- Federal resumes differ from private-sector ones (hours/week, GS grade, supervisor, detailed duties). When applying, follow the announcement's "How to apply" and "Requirements" sections.
- `who_may_apply` and `hiring_paths` decide eligibility. Veterans' preference / VEOA paths appear in `hiring_paths`.
- The CLI retries 429/5xx with backoff. All errors go to stderr as `{ "error": "...", "code": "..." }` with exit 1.
