# NORTHERN BIRD ANALYTICS — V2 ENHANCED BRANCH HANDOFF

## PROJECT OVERVIEW
- **App**: Northern Bird Analytics — upload CSV/Google Sheets → AI-powered dashboards with insights, recommendations, team sharing, white-label
- **Stack**: React 18, Vite, Tailwind, Supabase Pro, Anthropic Claude API, Vercel Pro
- **Production URL**: https://analytics-dashboard-v2-zeta.vercel.app
- **Preview URL**: analytics-dashboard-v2-git-v2-enhanced-vaish96-5704s-projects.vercel.app
- **GitHub**: github.com/vaish96-sudo/analytics-dashboard-v2
- **Branches**: `master` = production (untouched), `v2-enhanced` = feature branch (all new work)
- **Supabase**: https://sntaaixuewpsxuennqxe.supabase.co
- **Two separate folders on disk**: `analytics-dashboard-v2` (production) and `analytics-dashboard-v2-enhanced` (feature branch)

---

## WHAT'S BEEN BUILT (COMPLETED & DEPLOYED ON v2-enhanced)

### Phase 1: Security Refactor (on master, merged)
- All Supabase operations moved behind Vercel API routes (`api/data/*`)
- Frontend uses `src/lib/api.js` fetch wrapper with Bearer token auth
- Session validation via `api/lib/validateSession.js`
- Rate limiting (60 req/min per user, IP-based for auth routes)
- CSRF protection (Origin header check, allows vercel.app preview URLs)
- RLS locked down, anon key removed from frontend
- Audit logging on sensitive operations

### Phase 2: V2 Enhanced Features (on v2-enhanced branch)

#### 1. Auto-show AI insights on dashboard load ✅
- **File**: `src/components/InsightsPreview.jsx` (NEW)
- Auto-generates insights when dashboard loads if not already generated
- Shows "We found X things in your data" with top 3 insight cards at top of Overview tab
- Clicking cards navigates to AI tab
- Injected into `Dashboard.jsx` → `OverviewGrid` component

#### 2. Skip column tagger by default ✅
- **File**: `src/context/DataContext.jsx` (modified `loadData` function)
- `loadData` now: heuristic classify → AI classify → auto-confirm → straight to dashboard
- New `'building'` step shows "Building your dashboard" loading screen in `App.jsx`
- Column tagger still accessible via "Adjust columns" button in sidebar

#### 3. Column tagger fix ✅
- **Bug 1**: `updateColumnSchema` only worked on `pendingSchema` which was null after dashboard built
- **Fix**: New `editSchema()` function restores pending state from active dataset before opening tagger
- **Bug 2**: SummaryPill dropdown was invisible (`opacity-0 w-0`)
- **Fix**: Replaced with visible dropdown using `var(--bg-surface)` for dark mode compatibility
- Both fixes applied to production branch AND enhanced branch

#### 4. Google Sheets as primary quick action ✅
- **File**: `src/components/HomeScreen.jsx`
- Reordered: Google Sheets first with green border + "Popular" badge
- Copy: "Connect → dashboard in 60s"

#### 5. White-label moved to Pro tier ✅
- **File**: `src/lib/tierConfig.js` — Pro tier `whiteLabel: 'basic'`
- **File**: `src/components/UserProfile.jsx` — lock badge says "Pro" instead of "Enterprise"

#### 6. Friendlier labels ✅
- **File**: `src/components/ColumnTagger.jsx` — "Things you group by" / "Things you measure"
- **File**: `src/components/Dashboard.jsx` — "Adjust columns" replaces "Edit schema"

#### 7. AI executive summary in PDF exports ✅
- **File**: `src/utils/exportService.js`
- Structured executive summary with gold top accent, numbered key findings
- Insight cards: colored backgrounds per impact level (red/amber/blue), proper card height calculation, no overlapping

#### 8. Combined project creation wizard ✅
- **File**: `src/components/ProjectWizard.jsx`
- Name + template picker + data source on ONE screen (was 2 steps)

#### 9. 5 pre-built templates ✅ (UI only — not wired to dashboard rendering yet)
- **File**: `src/lib/templates.js` (NEW)
- Templates: Marketing Campaign, Sales Pipeline, E-commerce, Social Media, Financial Overview
- Each has: suggestedSchema patterns, kpiPriority, chartLayout hints, insightFocus prompt
- `detectTemplate()` auto-scores columns against templates
- Template picker shown in ProjectWizard after entering name
- **LIMITATION**: Templates are saved in project metadata but DO NOT yet change dashboard rendering (KPI order, chart selection, AI prompt)

#### 10. Auto-refresh for Google Sheets ✅ (backend + UI, not fully tested)
- **File**: `api/google-auth.js` — now returns `refresh_token`
- **File**: `src/App.jsx` — stores refresh token in localStorage on auth callback
- **File**: `api/data/enable-auto-refresh.js` (NEW) — saves refresh token + toggle per project
- **File**: `api/data/refresh-sheets.js` (NEW) — cron route that re-fetches all auto-refresh-enabled sheets
- **File**: `src/components/AutoRefreshToggle.jsx` (NEW) — toggle in dashboard sidebar for Google Sheets projects
- **File**: `vercel.json` — cron: runs daily at 6am UTC

#### 11. Instant tool page ✅ (basic — needs rebuild)
- **File**: `src/components/InstantDashboard.jsx` (NEW)
- Route: `/instant` (rewrite in vercel.json)
- `App.jsx` renders `InstantDashboard` when `pathname === '/instant'`
- Currently: basic CSV upload → simple KPI cards + bar charts
- AI insight call fails silently (requires auth)
- **NEEDS REBUILD**: Should use full DataContext pipeline (real KPIs, real charts, real AI insights) but without save/export/share

---

## WHAT NEEDS TO BE BUILT NEXT

### Priority 1: Make templates actually change the dashboard
Currently templates are just saved metadata. They need to:
- **Reorder KPIs**: When Marketing template is active, show Spend, Revenue, ROAS first instead of whatever order columns appear in CSV
- **Pick better charts**: Template defines chart layout hints (e.g., line chart for date × conversions, pie for channel × spend)
- **Tailor AI insights**: Pass `template.insightFocus` to the AI prompt so insights are domain-specific
- **Smarter column classification**: Use template's `suggestedSchema` to improve auto-classification (if template says "spend" is a metric, trust it over heuristic)

**Files to modify**: 
- `src/context/DataContext.jsx` — apply template during `loadData`, reorder columns
- `src/components/AutoCharts.jsx` → `useAutoChartData` — use template chartLayout hints
- `src/components/KPICards.jsx` → `useKPIData` — respect template kpiPriority
- `src/components/InsightsPreview.jsx` and `src/utils/aiService.js` — pass insightFocus to AI prompt

### Priority 2: Rebuild /instant page with full dashboard experience
The instant page should work like the real app minus persistence:
- Upload CSV → full column classification → real dashboard with KPIs, draggable charts, AI insights
- Use the actual `DataContext` pipeline but skip project/dataset database saving
- No export, no sharing, no settings — those show "Sign up to unlock" CTA
- AI insight should work without auth (needs a public endpoint, or handle 401 with a teaser)

**Files to modify**:
- `src/components/InstantDashboard.jsx` — rewrite to use real components
- Possibly `src/App.jsx` — may need to wrap instant page in DataProvider without auth
- Possibly `api/claude.js` — add a limited public endpoint for instant page insights

### Priority 3 (not started): Remaining product gaps
- Resend domain verification — blocks new user signups
- Stripe integration — Pro $19/mo checkout
- Landing page — currently goes straight to login
- Error toasts for API failures
- Facebook Ads + Google Ads direct connectors

---

## ALL FILES IN V2-ENHANCED BRANCH (changed/new vs master)

### New Files (6):
```
src/components/InsightsPreview.jsx      — auto-insights at dashboard top
src/components/InstantDashboard.jsx     — free /instant page  
src/components/AutoRefreshToggle.jsx    — daily refresh toggle
src/lib/templates.js                    — 5 pre-built templates
api/data/refresh-sheets.js              — cron route for auto-refresh
api/data/enable-auto-refresh.js         — toggle auto-refresh API
```

### Modified Files (12):
```
src/App.jsx                             — building step, instant route, refresh token storage
src/components/Dashboard.jsx            — InsightsPreview + AutoRefreshToggle + editSchema + "Adjust columns"
src/components/HomeScreen.jsx           — Google Sheets first with "Popular" badge
src/components/ColumnTagger.jsx         — visible dropdown, friendly labels, dark mode fix
src/components/ProjectWizard.jsx        — combined wizard + template picker
src/components/UserProfile.jsx          — White Label "Pro" badge
src/context/DataContext.jsx             — auto-build, editSchema, template detection, autoConfirmReady
src/lib/tierConfig.js                   — Pro whiteLabel: 'basic'
src/utils/exportService.js              — polished PDF, executive summary, insight cards
api/google-auth.js                      — returns refresh_token
api/lib/validateSession.js              — allows Vercel preview URLs
vercel.json                             — cron job + /instant rewrite
```

---

## KEY ARCHITECTURE DECISIONS

### Data Flow: Upload → Dashboard
1. User uploads CSV/connects Google Sheet
2. `DataContext.loadData()` called with parsed rows
3. Heuristic column classification runs instantly
4. AI column classification runs in background (calls `/api/claude` with feature='column_tagging')
5. `setStep('building')` shows loading screen
6. Template auto-detection runs (`detectTemplate()`)
7. `setAutoConfirmReady(true)` triggers useEffect
8. useEffect calls `confirmTagging()` which saves dataset to Supabase
9. `setStep('dashboard')` renders Dashboard with InsightsPreview auto-triggering

### Auth System
- Custom passwordless OTP via Resend (NOT Supabase auth)
- Sessions stored in `sessions` table with token + expires_at
- Frontend stores token in localStorage as `nb_session_token`
- All API routes validate via `validateSession.js`
- Google OAuth refresh token stored in localStorage as `nb_google_refresh_token`

### Template System
- Templates defined in `src/lib/templates.js`
- Each template has: suggestedSchema, kpiPriority, chartLayout, insightFocus
- `detectTemplate(columnNames)` scores columns against all templates, returns best match if >20% match
- `applyTemplate(template, schema, columnsByType)` returns kpiOrder and insightFocus
- Selected template stored in project's `data_source_meta.templateId`
- Template detection also runs in DataContext during loadData
- **Gap**: The returned kpiOrder and insightFocus are not yet consumed by KPICards, AutoCharts, or InsightsPreview

---

## ENVIRONMENT VARIABLES (Vercel)

### Required:
```
ANTHROPIC_API_KEY          — Claude API key
SUPABASE_URL               — https://sntaaixuewpsxuennqxe.supabase.co
SUPABASE_SERVICE_KEY       — service role key (server-side only)
RESEND_API_KEY             — for email OTP
FROM_EMAIL                 — sender email for OTP
VITE_GOOGLE_CLIENT_ID      — Google OAuth client ID (frontend)
GOOGLE_CLIENT_ID           — Google OAuth client ID (backend)
GOOGLE_CLIENT_SECRET       — Google OAuth client secret (backend)
```

### Removed (security):
```
VITE_SUPABASE_ANON_KEY     — was exposed in frontend, now removed
VITE_SUPABASE_URL          — was exposed in frontend, now removed
```

---

## DEPLOY COMMANDS

### Enhanced branch (feature testing):
```bash
cd analytics-dashboard-v2-enhanced
git add -A
git commit -m "your message"
git push origin v2-enhanced
```
Vercel auto-deploys preview at: analytics-dashboard-v2-git-v2-enhanced-vaish96-5704s-projects.vercel.app

### Production (when ready to ship):
```bash
cd analytics-dashboard-v2
git checkout master
git merge v2-enhanced
git push
```
Deploys to: analytics-dashboard-v2-zeta.vercel.app

---

## KNOWN ISSUES & BUGS

1. **Instant page AI insight fails** — calls `/api/claude` which requires auth. Needs public endpoint or graceful fallback
2. **Templates don't change dashboard rendering** — saved but not consumed by KPI/chart/insight components
3. **Auto-refresh not tested end-to-end** — cron route exists, toggle exists, but refresh token flow untested with real Google Sheets
4. **Resend not verified** — new user signups blocked
5. **No Stripe** — Pro tier can't be purchased
6. **No landing page** — goes straight to login screen
7. **Session tokens in localStorage** — low risk but not ideal
8. **No error toasts** — API failures are silent
