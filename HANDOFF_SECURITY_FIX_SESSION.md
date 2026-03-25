# NORTHERN BIRD ANALYTICS V2 — CONTEXT HANDOFF FOR SECURITY FIX SESSION

## What This Document Is
This is a complete context handoff for continuing work on Northern Bird Analytics V2. The next session needs to fix ALL security vulnerabilities identified in the audit. The developer should upload the `api/` folder contents to proceed.

---

## PROJECT OVERVIEW

**Product:** AI-powered analytics SaaS dashboard
**Live URL:** analytics-dashboard-v2-zeta.vercel.app
**GitHub:** github.com/vaish96-sudo/analytics-dashboard-v2 (branch: master)
**Stack:** React 18, Vite, Tailwind CSS, Recharts, Supabase (Pro $25/mo), Anthropic API (Claude), Vercel (Pro $20/mo)
**Supabase URL:** https://sntaaixuewpsxuennqxe.supabase.co

---

## WHAT THE APP DOES

Users upload CSV/Excel files → AI classifies columns → auto-generates dashboards with KPIs, charts, filters → AI tab with 3 modes:
1. **Ask AI** (Sonnet) — natural language questions about data
2. **Generate Insights** (Opus) — strategic analysis
3. **Recommendations** (Opus) — industry-specific actionable recommendations with expert frameworks

Also: Custom metrics with AI suggestions, Report Builder, Data Table, PDF/Word export, dark/light theme.

---

## FILE STRUCTURE

```
/
├── api/                          ← SERVERLESS FUNCTIONS (Vercel) — NEED TO BE UPLOADED
│   ├── claude.js                 ← Anthropic API proxy (CRITICAL security target)
│   ├── auth/
│   │   ├── login.js
│   │   ├── signup.js
│   │   ├── forgot-password.js    ← Has console.log of reset tokens!
│   │   └── reset-password.js
│   ├── fetch-external.js         ← External URL fetcher (SSRF risk)
│   ├── google-auth.js
│   ├── google-sheets-data.js
│   └── google-sheets-list.js
├── src/
│   ├── App.jsx                   ← Main app shell, routing, Google OAuth
│   ├── main.jsx
│   ├── index.css
│   ├── components/
│   │   ├── AIChartBuilder.jsx    ← AI-generated charts
│   │   ├── AIInsights.jsx        ← Insight generation UI
│   │   ├── AIHub.jsx             ← Unified AI tab with 3 modes
│   │   ├── AIRecommendations.jsx ← Industry-specific recommendations
│   │   ├── AskAI.jsx             ← Chat with data
│   │   ├── AuthScreen.jsx        ← Login/signup UI
│   │   ├── AutoCharts.jsx        ← Auto-generated overview charts
│   │   ├── ChatHistory.jsx
│   │   ├── ColumnTagger.jsx      ← AI column classification
│   │   ├── CustomMetrics.jsx     ← Formula-based custom metrics + AI suggest
│   │   ├── Dashboard.jsx         ← Main dashboard shell with 5 tabs
│   │   ├── DataTable.jsx
│   │   ├── FileUpload.jsx
│   │   ├── GlobalFilterBar.jsx
│   │   ├── GoogleSheetsPicker.jsx
│   │   ├── HomeScreen.jsx        ← Project list, folder sidebar
│   │   ├── KPICards.jsx
│   │   ├── LogoMark.jsx
│   │   ├── ProjectWizard.jsx
│   │   ├── ReportBuilder.jsx     ← Pivot table with sort, export
│   │   └── UserProfile.jsx
│   ├── context/
│   │   ├── AuthContext.jsx       ← Custom auth (NOT Supabase Auth)
│   │   ├── DataContext.jsx       ← Data state, schema, aggregation, custom metrics
│   │   ├── ProjectContext.jsx
│   │   └── ThemeContext.jsx
│   ├── lib/
│   │   ├── projectService.js     ← Supabase CRUD, Storage upload (TUS), download
│   │   ├── supabase.js           ← Supabase client init
│   │   └── tierConfig.js         ← Tier/plan configuration (NEW, not yet wired)
│   └── utils/
│       ├── aiService.js          ← askAI + getInsights functions with retry logic
│       ├── exportService.js      ← PDF/Word export
│       └── formatters.js
```

---

## ALL SECURITY FINDINGS TO FIX

### CRITICAL (fix first)

**C1: /api/claude has ZERO authentication**
- Anyone can POST to your Vercel URL and burn Anthropic credits
- No session check, no user validation
- FIX: Validate session token from request headers before proxying

**C2: Password reset tokens logged to Vercel console**
- File: api/auth/forgot-password.js, lines 48-49
- `console.log` of reset token and reset link
- FIX: Remove console.logs, implement real email sending

**C3: Supabase anon key logged to browser console**
- File: src/lib/supabase.js, line 5
- `console.log('KEY:', SUPABASE_ANON_KEY?.substring(0, 15))`
- FIX: Delete this line

### HIGH

**H1: RLS disabled on ALL Supabase tables**
- Any authenticated request can read/modify any user's data
- FIX: Enable RLS on all tables, add policies (projects: user_id = auth.uid(), datasets: via project ownership, etc.)
- NOTE: App uses custom auth, not Supabase Auth. RLS policies need to work with custom session validation OR migrate to Supabase Auth.

**H2: new Function() on user input for custom metric formulas**
- File: src/context/DataContext.jsx, line 170
- Regex validation exists but column VALUES could contain operators that bypass it
- FIX: Replace with safe math expression parser (math.js or custom recursive descent)

**H3: SSRF protection incomplete on api/fetch-external.js**
- Missing: 169.254.169.254 (AWS metadata — very dangerous on Vercel), ::1, 0.0.0.0, fd00::/8, fc00::/8
- FIX: Add complete blocklist including AWS metadata endpoint

### MEDIUM

**M1: No rate limiting on ANY API route**
- Brute force login, credential stuffing, AI cost abuse all unrestricted
- FIX: Add rate limiting (Vercel KV or in-memory) — especially /api/claude and /api/auth/login

**M2: max_tokens is caller-controlled with no server cap**
- File: api/claude.js — client passes max_tokens, server uses it directly
- FIX: `const safeMaxTokens = Math.min(max_tokens ?? 1024, 4096)`

**M3: Model is caller-controlled**
- Client can force claude-opus-4-6 on every request (15x more expensive)
- FIX: Server maps feature type → allowed model. Client sends feature name, not model string.

**M4: DEV_MODE bypass in AuthContext**
- `import.meta.env.DEV` — should be false on Vercel prod but could be true on preview deploys
- FIX: Remove DEV_MODE code paths entirely, or gate behind explicit env var

**M5: Google OAuth tokens flow through backend**
- api/google-sheets-data.js and api/google-sheets-list.js pass raw Google tokens through server
- Risk: tokens could end up in Vercel error logs

**M6: No per-user AI spend tracking**
- No mechanism to track per-user Anthropic costs
- A single user spamming Insights/Recommendations could cost more than their subscription
- FIX: Add usage counters (ai_queries_used, insights_runs_used, recommendations_runs_used) to user_profiles table

### LOW

**L1: Extensive console.log throughout production code**
- DataContext.jsx, projectService.js — logs dataset IDs, filter counts, state details
- FIX: Remove or gate behind DEV check

**L2: Sessions table grows without bound**
- No cleanup job for expired sessions of inactive accounts
- FIX: Add periodic cleanup (Supabase cron or Edge Function)

**L3: Retry logic can 5x costs on a single action**
- aiService.js: 3 retries on Opus, then 2 on Sonnet fallback = up to 5 API calls
- FIX: Add user-visible "retrying" state so they don't click again, and cap total retries

---

## COST PROTECTION CHECKLIST

1. [ ] Anthropic API budget alerts set in Anthropic Console
2. [ ] Hard monthly limit on Anthropic spending
3. [ ] Server enforces model selection (not client)
4. [ ] Server caps max_tokens at 4096
5. [ ] Per-user daily/monthly AI call limits
6. [ ] Rate limiting on /api/claude
7. [ ] Usage logging (user, model, tokens, cost per call)
8. [ ] Supabase Storage usage monitoring
9. [ ] Vercel bandwidth/invocation monitoring

---

## WHAT'S ALREADY DONE WELL (don't break these)

- Password hashing: PBKDF2 with 100K iterations and random salt
- password_hash stripped before returning user objects
- Session tokens: 32 bytes crypto.getRandomValues() (in production, not dev)
- Reset token expiry: 1 hour, checked correctly
- Post-reset: all sessions invalidated
- Formula regex does block string operators (just vulnerable to data injection)
- fetch-external blocks basic localhost/private IPs (just incomplete)

---

## DATABASE SCHEMA (Supabase)

**Tables:**
- `users` — id, email, password_hash, name, company, avatar_url, email_verified
- `sessions` — id, user_id, token, expires_at
- `projects` — id, user_id, name, data_source_type, data_source_meta
- `datasets` — id, project_id, file_name, schema_def, row_count, raw_data (jsonb), raw_data_path
- `dashboard_states` — id, dataset_id, active_tab, global_filters, charts_state, report_builder_state, data_table_state, insights, insights_loaded, recommendations, ai_charts, custom_metrics
- `conversations` — id, project_id, dataset_id, title
- `messages` — id, conversation_id, role, content, sql_plan, meta

**Storage:**
- Bucket: `datasets` (private, 500MB file limit)
- Files stored as gzipped JSON (.json.gz)
- TUS resumable upload for files >5MB

---

## RECENTLY BUILT FEATURES (context for understanding code)

- Industry-specific AI Recommendations (advertising expert framework from client's playbook)
- Industry detection from column names (advertising, ecommerce, manufacturing, SaaS, healthcare, logistics, finance)
- Gzip compression for data uploads
- TUS resumable upload for large files (bypasses 50MB proxy limit)
- Smart aggregation: ratio/average/sum for custom metrics
- Confidence badges on recommendations
- Tier configuration (tierConfig.js) — not yet wired into UI

---

## WHAT TO DO IN THE NEXT SESSION

1. User uploads the `api/` folder files
2. Fix ALL findings in priority order:
   - C1: Add auth to /api/claude
   - C2: Remove console.log of reset tokens
   - C3: Remove supabase key log
   - H1: Enable RLS + policies (may need to discuss Supabase Auth migration)
   - H2: Safe math parser for formulas
   - H3: Complete SSRF blocklist
   - M1: Rate limiting
   - M2: Cap max_tokens server-side
   - M3: Server-side model enforcement
   - M4: Remove DEV_MODE paths
   - M5: Google token handling
   - M6: Usage tracking table + counters
   - L1-L3: Console cleanup, session cleanup, retry safeguards
3. Add cost protection middleware
4. Test all fixes don't break existing functionality

---

## FILES THE DEVELOPER ALREADY HAS IN WORKING DIRECTORY

These files have been modified during this session and are the latest versions:
- src/components/AIRecommendations.jsx (industry-specific frameworks)
- src/components/CustomMetrics.jsx (aggregation fix, clear on switch)
- src/components/Dashboard.jsx (wider AI tab, sign-out label)
- src/components/ColumnTagger.jsx (tooltip on pills)
- src/components/ReportBuilder.jsx (memoized displayData for sort)
- src/components/AskAI.jsx (viewport height)
- src/context/DataContext.jsx (smart aggregation, ratio %, Storage download)
- src/lib/projectService.js (gzip, TUS resumable upload, downloadRawData)
- src/lib/tierConfig.js (NEW — tier limits config, not yet wired)
- src/lib/supabase.js (needs console.log removal)
