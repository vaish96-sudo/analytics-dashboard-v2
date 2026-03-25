# NORTHERN BIRD ANALYTICS V2 — HANDOFF FOR NEXT SESSION

## CRITICAL: Upload this file + both zip files (src.zip, api.zip) to the next chat

## Live App
- URL: https://analytics-dashboard-v2-zeta.vercel.app
- GitHub: github.com/vaish96-sudo/analytics-dashboard-v2 (branch: master)
- Stack: React 18, Vite, Tailwind CSS, Recharts, Supabase Pro, Anthropic API, Vercel Pro

## Supabase
- URL: https://sntaaixuewpsxuennqxe.supabase.co
- Tables: users, sessions, projects (has client_name column), datasets, dashboard_states, conversations, messages, user_profiles, teams, team_members, scheduled_reports, ai_usage_log, login_codes, client_access, logos bucket
- Need to create: project_access table (SQL provided in supabase_project_sharing.sql)

## Environment Variables (Vercel)
ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, RESEND_API_KEY, FROM_EMAIL

## What's Built (all working)
1. Security: All 15 audit findings fixed (session auth, RLS, SSRF blocklist, rate limiting, model enforcement, safe math eval)
2. Passwordless login (Resend - needs domain verification for non-test emails)
3. 3-tier system: Free/Pro($79)/Agency($199) with usage gating
4. Custom AI Playbook (Agency) - custom rules override built-in framework
5. White-label (Agency) - logo upload + company name
6. Team seats + invite emails via Resend
7. Pending invite acceptance flow on HomeScreen
8. Client folders in sidebar for Agency tier
9. Project creation with client assignment dropdown
10. Double-click rename projects and client folders (with delayed click to prevent navigation)
11. Drag-and-drop projects between client folders
12. Schema picker drag-and-drop (drag columns between category zones)
13. Individual KPI card drag-and-drop on overview
14. Individual chart drag-and-drop on overview (each chart is medium-sized widget)
15. Hide/restore widgets (X button, restore bar at top)
16. Client-level sharing via client_access table
17. Shared projects sidebar for team members
18. Shared project permissions (isSharedView, canEdit, viewer restrictions)
19. Onboarding overlay
20. AI JSON extraction fix, suggested queries fix, overview tab default

## IMMEDIATE BUGS TO FIX

### Bug 1: Share button (👥) on client folders not working
- Location: src/components/ClientShareMenu.jsx
- The share button appears on client folder headers in Agency sidebar
- Clicking it should show a dropdown with team members and checkboxes
- Issue: The query in ClientShareMenu filters `.neq('user_id', user.id)` but this might not match correctly
- The team_members table has 2 rows: owner (admin, vaish96@gmail.com) and dummy (viewer, vaish96+team1@gmail.com) — both active with user_ids set
- Fix: Check if the menu component mounts at all (might be CSS/positioning issue) or if the Supabase query returns empty

### Bug 2: Dummy account sees no shared projects
- Location: src/lib/projectService.js → listSharedProjects()
- The function checks client_access table for explicit grants
- client_access table is EMPTY — so no projects are shared (correct behavior)
- The fix: once the share button works and the owner grants access, projects should appear
- These two bugs are connected — fix Bug 1 and Bug 2 resolves itself

## FEATURES TO BUILD NEXT

### Priority 1: Project-level sharing
- Add share button (👥) on individual project rows in sidebar (not just client folders)
- Create project_access table (SQL in supabase_project_sharing.sql)
- Update listSharedProjects to check BOTH client_access AND project_access
- A project is visible if: its client folder is shared OR the individual project is shared
- Share menu should show team members with checkboxes (reuse ClientShareMenu pattern)

### Priority 2: Stripe integration
- Create Stripe account, products for Pro ($79/mo) and Agency ($199/mo)
- api/stripe/create-checkout.js — Stripe Checkout session
- api/stripe/webhook.js — handles subscription events, updates user_profiles.tier
- Billing portal link in Settings
- Pricing page/modal

### Priority 3: Resend domain verification
- Verify a domain in Resend so login codes and invite emails work for any address
- Update FROM_EMAIL env var

### Priority 4: Live data connectors
- Start with Google Ads API connector
- This is the #1 thing needed for paying customers

## FILE STRUCTURE
```
api/ (14 files + lib/)
  claude.js, lib/validateSession.js
  auth/: login.js, signup.js, forgot-password.js, reset-password.js, send-code.js, verify-code.js, send-invite.js
  fetch-external.js, google-auth.js, google-sheets-data.js, google-sheets-list.js, google-userinfo.js

src/ (44 files)
  App.jsx, main.jsx, index.css
  components/: AIChartBuilder, AIHub, AIInsights, AIRecommendations, AllChats, AllInsights, AskAI, AuthScreen, AutoCharts, ChatHistory, ClientShareMenu, ColumnTagger, CustomMetrics, Dashboard, DataTable, DraggableWidgets, FileUpload, GlobalFilterBar, GoogleSheetsPicker, HomeScreen, KPICards, LogoMark, OnboardingOverlay, PendingInvites, ProjectWizard, ReportBuilder, ScheduledReports, TeamManager, TierBadge, UpgradePrompt, UserProfile
  context/: AuthContext, DataContext, ProjectContext, ThemeContext, TierContext
  lib/: projectService, supabase, tierConfig
  utils/: aiService, claudeClient, exportService, formatters
```

## KEY ARCHITECTURE NOTES
- Frontend uses Supabase anon key for all reads/writes (RLS is open on most tables)
- Server-side API routes use service key for sensitive operations (claude, auth)
- AI calls go through api/claude.js which validates session, enforces model, tracks usage
- Tier gating happens in TierContext via useTier() hook
- ProjectContext loads both own projects (listProjects) and shared projects (listSharedProjects)
- DraggableWidgets uses HTML5 native drag API (no npm packages — network disabled)
- Widget order and hidden widgets saved to dashboard_states.widget_order as {order: [...], hidden: [...]}

## TESTING ACCOUNTS
- Main: vaish96@gmail.com (Agency tier, set manually in user_profiles)
- Dummy: vaish96+team1@gmail.com (Free tier, team member with viewer role)
- Team: both are in the same team, both active in team_members

## DATABASE KEY RELATIONSHIPS
- users.id → user_profiles.id (1:1, auto-created by trigger)
- users.id → projects.user_id (1:many)
- projects.id → datasets.project_id (1:many)
- datasets.id → dashboard_states.dataset_id (1:1)
- teams.id → team_members.team_id (1:many)
- client_access: team_id + user_id + client_name (grants folder access)
- project_access: team_id + user_id + project_id (grants project access) — TABLE NEEDS TO BE CREATED
