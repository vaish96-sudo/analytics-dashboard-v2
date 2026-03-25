# NORTHERN BIRD ANALYTICS V2 — HANDOFF: POST-SECURITY + FEATURES SESSION

## What Was Done In This Session

### Security Fixes (ALL completed)
- **C1:** Session auth on `/api/claude` — `api/lib/validateSession.js` validates Bearer tokens
- **C2:** Removed reset token console.logs from `forgot-password.js`
- **C3:** Removed Supabase anon key console.log from `supabase.js`
- **H1:** RLS enabled on all tables (with subsequent fix to allow frontend read/write on tables it uses directly — see `supabase_rls_fix.sql`)
- **H2:** Replaced `new Function()` with `safeMathEval()` recursive-descent parser in `DataContext.jsx`
- **H3:** Complete SSRF blocklist in `fetch-external.js` (AWS metadata, IPv6, protocol check)
- **M1:** Rate limiting on `/api/claude` (20/min/user) and `/api/auth/login` (10/5min/IP)
- **M2:** `max_tokens` capped at 4096 server-side
- **M3:** Server-side model enforcement via feature→model map. All frontend callers use `claudeClient.js`
- **M4:** DEV_MODE bypass paths removed from `AuthContext.jsx`
- **M5:** Google token error sanitization in both Sheets endpoints
- **M6:** Usage logging to `ai_usage_log` table
- **L1:** All console.logs removed from production code
- **L2:** Session cleanup function created (pg_cron ready)
- **L3:** Retry logic reduced from 5 to 3 max calls

### Passwordless Login (completed)
- `api/auth/send-code.js` — generates 6-digit code, stores in `login_codes`, sends via Resend
- `api/auth/verify-code.js` — validates code, auto-creates user if new, creates session
- `src/components/AuthScreen.jsx` — rewritten with code input UI, countdown timer, paste support
- Password login preserved as fallback behind "Use password instead"
- **Resend limitation:** Free tier only delivers to the signup email. Domain verification needed for production.

### Tier System (completed — 3 tiers)
- **`src/lib/tierConfig.js`** — Free / Pro ($79) / Agency ($199) with all limits defined
- **`src/context/TierContext.jsx`** — `useTier()` hook: `can()`, `hasRemaining()`, `remaining()`, `incrementUsage()`, `updateProfileField()`
- **`src/components/TierBadge.jsx`** — dynamic badge (gray Free, gold Pro, indigo Agency)
- **`src/components/UpgradePrompt.jsx`** — upgrade prompt, `BlurredPreview`, `UsageBadge`
- Usage gating on Ask AI, Insights, Recommendations with counters + increment
- Custom Metrics gated to Pro+
- `user_profiles` table with tier, usage counters, monthly reset function

### Feature 1: Custom AI Playbook (completed)
- Textarea in Settings (UserProfile.jsx) for Agency+ users
- Saved to `user_profiles.custom_ai_playbook`
- Injected into AIRecommendations system prompt with explicit conflict resolution: custom rules override built-in framework
- Gated behind `can('customPlaybook')` — Agency only

### Feature 2: White-Label (completed)
- Logo upload to Supabase Storage `logos` bucket in Settings
- Custom company name field
- Both saved to `user_profiles.custom_logo_url` and `custom_company_name`
- `exportService.js` updated: `exportToPDF()` and `exportToWord()` accept `branding` parameter
- Gated behind `can('whiteLabel')` — Agency only
- **NOTE:** Export buttons in components don't pass branding yet — need to wire `useTier()` profile data into export calls

### Feature 3: Tier Gating Skeleton (completed)
- All AI features gated with usage counting
- Upgrade prompts shown when limits hit
- Usage meters in Settings page
- Plan display with current tier info

### Feature 4: Team Seats (completed)
- `teams` + `team_members` tables
- TeamManager component in Settings — create team, invite by email, manage roles, remove members
- **`api/auth/send-invite.js`** — sends invite email via Resend
- **`src/components/PendingInvites.jsx`** — banner on HomeScreen for pending invites, accept/decline flow
- Invite acceptance links user to team, updates `user_profiles.team_id`
- Shared projects visible in sidebar under "Shared with me" grouped by `client_name`
- **NOTE:** Resend domain verification needed for invite emails to reach arbitrary addresses

### Feature 5: Scheduled Reports UI (completed — UI only)
- `scheduled_reports` table
- `ScheduledReports.jsx` component on Settings tab inside Dashboard
- Create schedule: frequency (daily/weekly/monthly), recipients, content toggles
- Toggle enable/disable, delete
- **NOT YET BUILT:** The actual cron/Edge Function to generate and send PDFs. The UI stores schedules but nothing sends them yet.
- **PRODUCT NOTE:** Scheduled reports don't make sense for static CSV uploads. Better as "Send report now" button. Activate scheduled reports when live connectors exist.

### Feature 6: Onboarding (completed)
- `OnboardingOverlay.jsx` — 4-step walkthrough (Upload → Columns → Dashboard → AI)
- Shown on first login when `user_profiles.onboarding_completed = false`
- Dismissable at any step, marks profile as completed
- Renders over HomeScreen

### Other Fixes
- Projects always open on Overview tab (not last-used tab)
- AI JSON extraction: handles responses with text before JSON block
- Suggested queries auto-send on click and show as user message bubble
- Agency sidebar shows projects grouped by `client_name` column

---

## CURRENT FILE STRUCTURE

```
├── api/
│   ├── claude.js                 ← Authenticated, rate-limited, model-enforced, usage-logged
│   ├── lib/
│   │   └── validateSession.js    ← Shared session validation helper
│   ├── auth/
│   │   ├── login.js              ← Rate-limited (10/5min/IP)
│   │   ├── signup.js
│   │   ├── forgot-password.js    ← Token logs removed
│   │   ├── reset-password.js
│   │   ├── send-code.js          ← Passwordless: generate + email 6-digit code
│   │   ├── verify-code.js        ← Passwordless: verify code + create session
│   │   └── send-invite.js        ← Team invite email via Resend
│   ├── fetch-external.js         ← Complete SSRF blocklist
│   ├── google-auth.js
│   ├── google-sheets-data.js     ← Error sanitization
│   ├── google-sheets-list.js     ← Error sanitization
│   └── google-userinfo.js
├── src/
│   ├── App.jsx                   ← TierProvider added, onboarding overlay, overview tab default
│   ├── components/
│   │   ├── AIChartBuilder.jsx    ← Uses callClaudeAPI (authenticated)
│   │   ├── AIHub.jsx
│   │   ├── AIInsights.jsx        ← Tier-gated: usage counting + UsageBadge
│   │   ├── AIRecommendations.jsx ← Tier-gated + custom playbook injection with conflict resolution
│   │   ├── AskAI.jsx             ← Tier-gated + suggested queries fix + JSON extraction
│   │   ├── AuthScreen.jsx        ← Passwordless login (code input) + password fallback
│   │   ├── AutoCharts.jsx        ← Uses callClaudeAPI
│   │   ├── ColumnTagger.jsx
│   │   ├── CustomMetrics.jsx     ← Tier-gated (Pro+), uses callClaudeAPI
│   │   ├── Dashboard.jsx         ← TierBadge, ScheduledReports on settings tab
│   │   ├── DataTable.jsx
│   │   ├── FileUpload.jsx
│   │   ├── GlobalFilterBar.jsx
│   │   ├── GoogleSheetsPicker.jsx
│   │   ├── HomeScreen.jsx        ← Agency client grouping, shared projects, PendingInvites, TierBadge
│   │   ├── KPICards.jsx
│   │   ├── LogoMark.jsx
│   │   ├── OnboardingOverlay.jsx ← NEW: 4-step walkthrough
│   │   ├── PendingInvites.jsx    ← NEW: invite acceptance banner
│   │   ├── ProjectWizard.jsx
│   │   ├── ReportBuilder.jsx
│   │   ├── ScheduledReports.jsx  ← NEW: schedule config UI
│   │   ├── TeamManager.jsx       ← NEW: team create/invite/manage
│   │   ├── TierBadge.jsx         ← NEW: dynamic tier badge component
│   │   ├── UpgradePrompt.jsx     ← NEW: upgrade prompt + BlurredPreview + UsageBadge
│   │   └── UserProfile.jsx       ← Rewritten: plan display, usage, white-label, playbook, team
│   ├── context/
│   │   ├── AuthContext.jsx       ← sendCode + verifyCode added
│   │   ├── DataContext.jsx       ← safeMathEval, callClaudeAPI
│   │   ├── ProjectContext.jsx    ← sharedProjects loading added
│   │   ├── ThemeContext.jsx
│   │   └── TierContext.jsx       ← NEW: useTier() hook
│   ├── lib/
│   │   ├── projectService.js     ← listSharedProjects added, client_name in queries
│   │   ├── supabase.js           ← Key log removed
│   │   └── tierConfig.js         ← NEW: 3-tier config with helpers
│   └── utils/
│       ├── aiService.js          ← Feature-based calls, JSON extraction fix, capped retries
│       ├── claudeClient.js       ← NEW: authenticated API wrapper
│       ├── exportService.js      ← Branding parameter support
│       └── formatters.js
```

---

## DATABASE SCHEMA (Current)

### Original tables
- `users` — id, email, password_hash, name, company, avatar_url, email_verified
- `sessions` — id, user_id, token, expires_at
- `projects` — id, user_id, name, **client_name** (NEW), data_source_type, data_source_meta
- `datasets` — id, project_id, file_name, schema_def, row_count, raw_data, raw_data_path
- `dashboard_states` — id, dataset_id, active_tab, global_filters, charts_state, report_builder_state, data_table_state, insights, insights_loaded, recommendations, ai_charts, custom_metrics
- `conversations` — id, project_id, dataset_id, title
- `messages` — id, conversation_id, role, content, sql_plan, meta

### New tables (from this session)
- `user_profiles` — id (FK→users), tier, team_id, role, ai_queries_used, insights_runs_used, recommendations_runs_used, ai_suggest_runs_used, usage_reset_at, custom_logo_url, custom_company_name, custom_ai_playbook, onboarding_completed
- `ai_usage_log` — id, user_id, feature, model, input_tokens, output_tokens, estimated_cost_usd, created_at
- `login_codes` — id, email, code, expires_at, attempts
- `teams` — id, name, owner_id
- `team_members` — id, team_id, user_id, role, status (pending/active/declined), invited_email
- `scheduled_reports` — id, dataset_id, created_by, frequency, recipients[], include_insights, include_recommendations, include_kpis, last_sent_at, next_send_at, enabled

### Storage buckets
- `datasets` — private, 500MB limit, gzipped JSON
- `logos` — public, 5MB limit, user logos for white-label

### RLS State
- `users`, `login_codes`, `ai_usage_log` — locked to service key only
- All other tables — SELECT open, INSERT/UPDATE/DELETE open (needed because frontend uses anon key for writes)
- **Future improvement:** Move all writes to server-side API routes and lock down anon key to SELECT only

### Triggers
- `on_user_created` → auto-creates `user_profiles` row
- Monthly usage reset function ready (needs pg_cron)

---

## ENVIRONMENT VARIABLES (Vercel)

- `ANTHROPIC_API_KEY` — Anthropic API key
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_KEY` — Supabase service role key
- `RESEND_API_KEY` — Resend email API key
- `FROM_EMAIL` — Sender address (currently `onboarding@resend.dev`, needs verified domain for production)
- `VITE_SUPABASE_URL` — Frontend Supabase URL
- `VITE_SUPABASE_ANON_KEY` — Frontend Supabase anon key

---

## FEATURES TO BUILD NEXT

### Priority 1: Project & Sidebar Management (essential for Agency UX)

**P1A: Project creation flow with client assignment**
- When Agency user clicks "New project", show a modal/dropdown: "Which client is this for?" with existing client names + "New client" option + "Personal" option
- Personal projects go under "My Projects" (no client_name)
- Client projects get `client_name` set and appear under that client folder
- Team members should be able to create projects under shared clients if role is editor/admin

**P1B: Rename projects and client folders from sidebar**
- Right-click or three-dot menu on projects → Rename, Delete, Move to client
- Right-click or three-dot menu on client folder headers → Rename client
- Update `projects.name` or `projects.client_name` in Supabase on rename

**P1C: Drag and drop projects between client folders**
- Use a drag-and-drop library (react-beautiful-dnd or dnd-kit)
- Dragging a project from one client to another updates `projects.client_name`
- Dragging from "Uncategorized" to a client folder assigns the client
- Visual feedback: drag ghost, drop target highlight
- Save immediately on drop

**P1D: Drag and drop to reorder projects within a folder**
- Add `sort_order` column to `projects` table
- Drag to reorder within a client group
- Save new order to database

### Priority 2: Schema Picker Drag-and-Drop

**P2A: Drag columns between categories on ColumnTagger**
- Currently columns are tagged as dimension/metric/date/ignore via dropdown or buttons
- Add drag-and-drop: user can drag a column pill from "Dimensions" zone to "Metrics" zone (or vice versa)
- Use dnd-kit with droppable zones for each category
- On drop, update the column's type in the pending schema
- Keep the existing click-to-change as fallback for accessibility

### Priority 3: Dashboard Layout Drag-and-Drop

**P3A: Drag and rearrange visuals on Overview tab**
- Currently: KPICards → AIChartBuilder → AutoCharts in fixed order
- Add a grid layout system (react-grid-layout recommended — built for dashboards)
- Each chart/KPI card becomes a draggable, resizable widget
- User can rearrange, resize, and the layout persists per dataset
- Save layout to `dashboard_states.layout_config` (new jsonb column)
- AI-generated charts from AIChartBuilder should also be draggable widgets in the same grid

**P3B: Persist layout per dataset**
- Add `layout_config jsonb` column to `dashboard_states`
- Save grid positions/sizes when user finishes dragging
- Restore on next visit

### Priority 4: Stripe Integration

**P4A: Stripe Checkout**
- Create Stripe account and products for Pro ($79/mo) and Agency ($199/mo)
- `api/stripe/create-checkout.js` — creates Stripe Checkout session
- Redirect user to Stripe-hosted checkout page
- On success, redirect back with session ID

**P4B: Stripe Webhooks**
- `api/stripe/webhook.js` — receives Stripe events
- `checkout.session.completed` → update `user_profiles.tier` to purchased tier
- `customer.subscription.deleted` → downgrade to free
- `invoice.payment_failed` → send warning email
- Verify webhook signature with Stripe signing secret

**P4C: Billing Portal**
- "Manage subscription" button in Settings → redirects to Stripe Customer Portal
- User can cancel, update payment method, view invoices

**P4D: Pricing Page**
- Public pricing page (or modal within app) showing Free vs Pro vs Agency
- Feature comparison table
- "Start free trial" / "Upgrade" buttons that trigger Stripe Checkout
- Can be a new route or a modal accessible from upgrade prompts

### Priority 5: Resend Domain Verification
- Buy/use a domain for sending emails
- Add DNS records in Resend
- Update `FROM_EMAIL` env var in Vercel
- Enables: login codes to any email, invite emails to any email, future report emails

### Priority 6: Export Branding Wiring
- Wire `useTier()` profile data into export buttons across components
- When user has `custom_logo_url` and `custom_company_name`, pass as `branding` param to `exportToPDF()` and `exportToWord()`
- Components to update: AIInsights, AIRecommendations, AskAI, Dashboard export button

### Priority 7: Scheduled Report Sender (after live connectors exist)
- Supabase Edge Function or external cron
- Checks `scheduled_reports` where `next_send_at < now()` and `enabled = true`
- Generates PDF server-side
- Sends via Resend
- Updates `last_sent_at` and calculates `next_send_at`

### Priority 8: "Send Report Now" Button
- More useful than scheduled reports for static data
- Button on Dashboard that generates PDF and emails it to specified recipients
- Uses existing exportToPDF + Resend
- Quick modal: enter recipient emails → send

---

## DRAG-AND-DROP LIBRARY RECOMMENDATION

**Use `@dnd-kit`** (not react-beautiful-dnd which is deprecated). It covers all three drag-and-drop needs:
- Sidebar: `SortableContext` for reordering projects, `DndContext` with droppable client folders
- Schema picker: `DndContext` with droppable category zones
- Dashboard: Use alongside `react-grid-layout` for widget positioning

Install: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
For dashboard grid: `npm install react-grid-layout`

---

## KNOWN ISSUES / TECH DEBT

1. **RLS is too open** — frontend uses anon key for all Supabase writes. Ideally, writes should go through authenticated server-side API routes. Major refactor needed.
2. **Scheduled reports sender not built** — UI exists but no cron/Edge Function sends emails
3. **Export branding not wired** — export functions accept branding param but components don't pass it yet
4. **Resend domain not verified** — login codes and invite emails only work for the Resend signup email
5. **No Stripe** — tier changes are manual in Supabase
6. **AI sometimes returns text before JSON** — extraction regex handles it but the root cause is prompt engineering (tell Claude more firmly to return ONLY JSON)
7. **`client_name` assignment** — no UI to set it during project creation, only manually in Supabase
8. **Shared project permissions** — team members can currently view shared projects but the viewer/editor/admin role distinction isn't enforced in the UI (everyone can edit)
9. **Team member count on sidebar** — no indicator of how many team members are active
10. **Mobile responsive** — sidebar shared section may not render well on mobile

---

## COST STRUCTURE

| Service | Monthly Cost |
|---------|-------------|
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Resend (free tier) | $0 (3K emails/mo) |
| Anthropic API | Variable — tracked in ai_usage_log |
| Domain (for Resend) | ~$12/year |
| **Total fixed** | **~$46/mo** |

AI cost per user (estimated):
- Free user (5 Sonnet queries): ~$0.05
- Pro user (unlimited Sonnet + 10 Opus recommendations): ~$2-5/mo
- Agency user (unlimited everything): ~$5-15/mo

---

## PRICING (Current)

| | Free | Pro | Agency |
|---|---|---|---|
| Price | $0 | $79/mo | $199/mo |
| Projects | 1 | 15 | Unlimited |
| Rows/dataset | 5,000 | 500,000 | 1,000,000 |
| Ask AI | 5/mo | Unlimited | Unlimited |
| Insights | 1/mo | Unlimited | Unlimited |
| Recommendations | — (preview) | 10/mo | Unlimited |
| Custom Metrics | — | ✓ | ✓ |
| PDF/Word Export | — | ✓ | ✓ |
| White Label | — | — | ✓ |
| AI Playbook | — | — | ✓ |
| Team Seats | — | — | 5 included |
| Connectors | — | ✓ | ✓ |

Competitor: AgencyAnalytics charges $79-479/month for dashboards with ZERO AI analysis.
