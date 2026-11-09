import { api, clean, err, toCard, type Flags, type Fmt } from "../helpers.ts"

export async function runDetail(flags: Flags, fmt: Fmt): Promise<number> {
  const raw = flags._[1]
  if (!raw) return err("detail needs a job id or usajobs.gov/job/<id> URL", "BAD_ARG")
  const m = String(raw).match(/(?:usajobs\.gov\/(?:GetJob\/ViewDetails|job)\/)?(\d{5,})/i)
  if (!m) return err(`could not read a USAJOBS control number from "${raw}"`, "BAD_ARG")
  // The API ignores ControlNumber (it returns every posting); a Keyword search on the number matches it exactly.
  const data = await api(new URLSearchParams({ Keyword: m[1], ResultsPerPage: "10" }))
  const item = (data?.SearchResult?.SearchResultItems ?? []).find((it: any) => String(it?.MatchedObjectId) === m[1] || String(it?.MatchedObjectDescriptor?.PositionURI ?? "").endsWith("/" + m[1]))
  if (!item) return err(`no open USAJOBS posting with control number ${m[1]} (it may have closed)`, "NOT_FOUND")
  const d = item.MatchedObjectDescriptor ?? {}
  const ua = d?.UserArea?.Details ?? {}
  const out = {
    ...toCard(item),
    summary: clean(ua.JobSummary) || null,
    duties: Array.isArray(ua.MajorDuties) ? ua.MajorDuties.map(clean).join("\n") : clean(ua.MajorDuties) || null,
    qualifications: clean(d.QualificationSummary) || null,
    requirements: clean(ua.Requirements) || null,
    education: clean(ua.Education) || null,
    evaluations: clean(ua.Evaluations) || null,
    security_clearance: clean(ua.SecurityClearance) || null,
    hiring_paths: Array.isArray(ua.HiringPath) ? ua.HiringPath.map(clean) : [],
    schedule: clean(d?.PositionSchedule?.[0]?.Name) || null,
    how_to_apply: clean(ua.HowToApply) || null,
  }
  if (fmt === "json") { process.stdout.write(JSON.stringify(out, null, 2) + "\n"); return 0 }
  const sec = (h: string, v: unknown) => ((Array.isArray(v) ? v.length : v) ? `\n## ${h}\n${Array.isArray(v) ? v.join(", ") : v}\n` : "")
  process.stdout.write(
    `${out.title}\n${out.company ?? ""} · ${out.location ?? ""}\nPosted ${out.date ?? "—"} · Closes ${out.closes ?? "—"} · ${out.salary ?? ""} ${out.grade ?? ""}\nWho may apply: ${out.who_may_apply ?? "—"} · Clearance: ${out.security_clearance ?? "—"}\n${out.url}\n` +
    sec("Summary", out.summary) + sec("Duties", out.duties) + sec("Qualifications", out.qualifications) +
    sec("Requirements", out.requirements) + sec("Education", out.education) + sec("Hiring paths", out.hiring_paths) +
    sec("How you will be evaluated", out.evaluations) + "\n")
  return 0
}
