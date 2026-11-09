# AI Job Search: U.S. Edition (Windows Setup Guide)

This fork adapts [ai-job-search](https://github.com/ai-job-search-dev/ai-job-search), created by **[Mads Lorentzen](https://www.linkedin.com/in/mads-lorentzen/)** in Denmark, for a job search in the **United States**. The original framework, its methodology, and almost all of the code are his work, released under the MIT License. This fork adds a U.S. federal job board, Windows setup steps, and U.S.-specific guidance.

If this helps you, credit belongs to the original author first. Support his project through the links in the main [README](README.md).

---

## What this fork changes

| Change | Detail |
| --- | --- |
| **USAJOBS portal skill** | `.agents/skills/usajobs-search/` searches U.S. federal jobs through the official, free [USAJOBS Search API](https://developer.usajobs.gov/). It returns agency, grade, salary, closing date, telework/remote flags, who may apply, and hiring paths (including veterans' preference paths). |
| **Windows setup** | Step-by-step install with `winget`, plus a fix for the common `python3` PATH conflict on Windows. |
| **U.S. job boards** | LinkedIn (built in, works for U.S. searches), freehire (built in), and USAJOBS (added). The Danish boards ship disabled. |
| **This guide** | U.S. market notes: salary floors, remote/hybrid rules, federal resumes, clearances. |

### Job boards that were evaluated and **not** added

| Board | Reason |
| --- | --- |
| Indeed | Returns HTTP 403 to scripted requests. Use the `/scrape` WebSearch fallback or paste postings into `/apply`. |
| Dice | Its `robots.txt` disallows search result pages (`/jobs?q*`). The framework's own robots check would refuse it. |

---

## 1. Install the tools (Windows 10/11)

Open **PowerShell** and run:

```powershell
winget install --id GitHub.cli -e
winget install --id Oven-sh.Bun -e
winget install --id MiKTeX.MiKTeX -e
winget install --id Python.Python.3.11 -e     # skip if you already have Python 3.10+
irm https://claude.ai/install.ps1 | iex       # Claude Code CLI
```

Claude Code requires a paid Claude plan (Pro, Max, Team) or Anthropic API credits.

If the Claude installer says `C:\Users\<you>\.local\bin is not in your PATH`, add it:

```powershell
$b="$env:USERPROFILE\.local\bin"; $p=[Environment]::GetEnvironmentVariable('Path','User')
[Environment]::SetEnvironmentVariable('Path',"$p;$b",'User')
```

### Fix `python3` on Windows

The framework calls `python3`. On many Windows machines that name points to a Microsoft Store stub, and other software (MySQL Shell, for example) can put its own `python.exe` first on the PATH. Check:

```powershell
where.exe python python3
```

If `python3` is the WindowsApps stub or is missing, point it at your real Python install (adjust the version folder):

```powershell
$py="$env:USERPROFILE\AppData\Local\Programs\Python\Python311"
Copy-Item "$py\python.exe" "$py\python3.exe"
$p=[Environment]::GetEnvironmentVariable('Path','User')
[Environment]::SetEnvironmentVariable('Path',"$py;$py\Scripts;$p",'User')
```

Close PowerShell and open a new window so the PATH changes load. Then confirm:

```powershell
python3 --version; bun --version; lualatex --version; claude --version
python3 -m pip install --user pypdf
```

---

## 2. Get the code, privately

> **Important:** `/setup` writes your name, contact details, work history and salary expectations into tracked files. A GitHub **fork is always public**. Do not run `/setup` in a public fork and push it.

Use a **private** repository for your own search:

```powershell
gh auth login --web --scopes "repo,workflow"
cd $env:USERPROFILE\Documents
git clone https://github.com/Nlewis0428/ai-job-search-usa.git ai-job-search
cd ai-job-search
git remote rename origin upstream
gh repo create ai-job-search --private --source . --remote origin --push
```

You can now pull improvements with `git pull upstream master` and keep your personal changes in your private `origin`. The `workflow` scope is needed because the repo contains GitHub Actions files. You can turn Actions off in the private repo's settings if you don't want them to run.

Install the portal CLIs:

```powershell
python3 tools\install_portal_clis.py
```

---

## 3. Get a USAJOBS API key (free)

1. Request a key at <https://developer.usajobs.gov/apirequest>. It arrives by email.
2. Store it as user environment variables, then open a new PowerShell window:

```powershell
setx USAJOBS_API_KEY "your-key"
setx USAJOBS_EMAIL "the-email-the-key-was-issued-to"
```

3. Test it:

```powershell
bun run .agents/skills/usajobs-search/cli/src/cli.ts search -q "identity access management" --jobage 14 --format table
```

Without the key, the USAJOBS skill exits with `NO_API_KEY` and `/scrape` skips it. Everything else still works.

---

## 4. Use a dedicated job-search email

Create a separate Gmail address for applications. It keeps recruiter mail and spam out of your personal inbox and enables `/gmail-sync`, which reads interview invites and rejections and proposes tracker updates. If you own a domain, you can forward an address on it (for example through Cloudflare Email Routing) to that Gmail and put the domain address on your resume.

---

## 5. Add your documents

Put files in the subfolders of `documents\`. That folder is git-ignored and never uploaded.

| Folder | What goes in it |
| --- | --- |
| `cv\` | Your most complete resume (PDF) |
| `linkedin\` | LinkedIn profile PDF: on your profile, **Resources** or **More**, then **Save to PDF**. The full data export's CSVs (`Positions.csv`, `Skills.csv`, `Education.csv`, `Certifications.csv`) also work |
| `diplomas\` | Degrees and certificates |
| `references\` | Reference letters |
| `projects\` | Case studies, portfolio write-ups |

---

## 6. Run `/setup`

```powershell
cd $env:USERPROFILE\Documents\ai-job-search
claude
```

At the Claude Code prompt type `/setup` and choose **Path A: Documents folder**. U.S.-specific answers to give it:

- **Market:** United States; remote, and/or hybrid within commuting distance of your city.
- **Work authorization:** U.S. citizen or authorized to work in the U.S. This lets it pass "must be a U.S. citizen" requirements.
- **Salary:** a base salary floor in USD. Postings with no salary are flagged rather than rejected.
- **Clearance:** say whether you hold or held one. Many federal and defense roles require it.
- **Veteran status:** if applicable. USAJOBS results show veterans' preference hiring paths.
- **Deal-breakers:** for example on-site only, regular weekend work, help-desk as the core function.

Check what it wrote, especially the search keywords in `.claude/skills/job-scraper/search-queries.md`. Correct any wrong terminology (for example SOC 2 versus SOX).

---

## 7. Daily workflow

| Step | Command | What it does |
| --- | --- | --- |
| 1 | `/outcome` | Record replies from employers (interview, rejection, offer) |
| 2 | `/scrape` | Search LinkedIn, freehire and USAJOBS for new postings (last 14 days) |
| 3 | `/rank` | Score new postings 0-100 against your profile and deal-breakers |
| 4 | `/apply <url or pasted text>` | Evaluate fit, draft a tailored resume and cover letter, review, compile PDFs |
| 5 | (you) | Read the drafts, correct anything wrong, submit on the employer's site |
| 6 | `/outcome followup` | Twice a week: draft follow-ups for applications quiet 10+ days |
| 7 | `/html-report` | Offline dashboard of your whole funnel |
| 8 | `/interview` | Prep pack and mock interview before each round |

Your application record lives in `job_search_tracker.csv`. Statuses move `drafted` → `applied` → `interview` → `offer` → `hired`, or end as `rejected`, `no_response` or `offer_declined`.

**Keep a daily activity log** (date, activity, employer, position, method, contact, result) if you need a work-search record, for example for unemployment benefits. Check your state's exact requirements.

---

## 8. Federal applications (USAJOBS)

- **Closing dates are hard deadlines.** The skill returns `closes` for every posting. Apply early.
- **Federal resumes are different.** Include hours per week, salary or grade, supervisor contact, and detailed duties for each role. Follow each announcement's *How to apply* and *Requirements* sections.
- **Who may apply** and **hiring paths** decide eligibility. Check `who_may_apply` and `hiring_paths` in `detail` output. Veterans: look for VEOA and veterans' preference paths.
- Useful searches: series `2210` (IT Management), parenthetical specialties such as `INFOSEC`, `SYSADMIN`, `SECURITY`.

---

## 9. Troubleshooting

| Problem | Fix |
| --- | --- |
| `claude`, `bun` or `python3` not recognized | Open a new PowerShell window. PATH loads when the window starts |
| `python3` crashes with `No module named 'encodings'` | Another program's `python.exe` is first on PATH. See *Fix python3 on Windows* |
| USAJOBS returns `NO_API_KEY` | Key not set, or the window was opened before `setx` ran |
| USAJOBS returns `AUTH` | `USAJOBS_EMAIL` must match the address the key was issued to |
| A job page won't load in `/apply` | Paste the full posting text, or save it as `documents\postings\<Company> - <Title>.txt` |
| A board returns zero results | `/scrape health` |
| PDF compile fails | `miktex packages update`, then retry. MiKTeX installs missing packages on first use |
| `git push` rejected: workflow scope | `gh auth refresh -s workflow` |

---

## Credits and license

- **Original author:** [Mads Lorentzen](https://www.linkedin.com/in/mads-lorentzen/). Framework, methodology, commands, agents and portal pattern. Upstream repository: <https://github.com/ai-job-search-dev/ai-job-search>.
- **U.S. adaptation:** [Nathaniel Lewis](https://www.linkedin.com/in/identityaccessmanager/). USAJOBS portal skill, Windows setup and this guide.
- Licensed under the MIT License. See [LICENSE](LICENSE). The original copyright notice is retained as the license requires.
- This project is not affiliated with Anthropic, USAJOBS / OPM, or LinkedIn. LinkedIn's public job pages are used at low volume for personal use only. See LinkedIn's Terms of Service.
