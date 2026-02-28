# Brasfrut PCP - Planejamento e Controle de Produção

## Overview
Fullstack PCP application for Brasfrut company. The PCP (production planning & control) interface is served as an HTML file inside an iframe, communicating with the React parent via postMessage. Backend provides authentication, role-based access, and server-side persistence via PostgreSQL.

## Architecture
- **Frontend**: React + Vite + shadcn/ui + wouter routing
- **Backend**: Express.js + Token-based auth + PostgreSQL via Drizzle ORM (pg driver)
- **Auth**: Bearer token auth (tokens stored in DB, sent via localStorage + Authorization header)
- **PCP HTML**: Served at `/api/pcp.html`, embedded in iframe on the main page
- **Communication**: postMessage protocol between React parent and PCP iframe
- **Database**: Compatible with any PostgreSQL (Neon, Supabase, Railway, etc.)

## Key Files
- `shared/schema.ts` - Database schema (users, auth_tokens, pcp_states, pcp_comments, pcp_params, pcp_coverage, pcp_notes)
- `server/routes.ts` - API routes (auth, PCP state CRUD, coverage, week rotation utilities)
- `server/storage.ts` - PostgreSQL storage layer using drizzle-orm/node-postgres
- `server/auth.ts` - Token-based auth with scrypt password hashing, DB-persisted tokens
- `client/src/pages/login.tsx` - Login page with Brasfrut branding
- `client/src/pages/pcp.tsx` - Main PCP page with iframe + header bar
- `client/src/hooks/use-auth.ts` - Auth hook with token management (localStorage)
- `client/public/pcp.html` - The full PCP HTML application

## PostMessage Protocol
- `PCP_MODE` - Sets admin/readonly mode in iframe
- `PCP_SET_STATE` - Sends saved state (weeks, comments, params, notes) to iframe
- `PCP_SET_COVERAGE` - Sends saved coverage data to iframe
- `PCP_GET_STATE` - Requests full state from iframe
- `PCP_FULL_STATE` - iframe responds with full pcpState object
- `PCP_IFRAME_READY` - iframe signals it has loaded

## Data Persistence Flow
1. On page load: React fetches `/api/pcp/full-state` → sends `PCP_SET_STATE` to iframe
2. `PCP_SET_STATE` handler merges data into `pcpState`, calls `applyWeekToDOM()` for current week
3. On save: React accesses iframe's `pcpState` directly (or via postMessage fallback)
4. Save captures: current week DOM state, all week data in pcpState.weeks, notes, params, coverage
5. Week picker saves current week to pcpState.weeks before switching to new week
6. Notes are saved to pcpState.notes on each keystroke and during week switch

## Database Tables
- `users` - id (serial), username, password, is_admin
- `auth_tokens` - id (serial), token (unique), user_id, expires_at
- `pcp_states` - week_key (unique), data (jsonb) - PCP grid data per week
- `pcp_comments` - week_key (unique), data (jsonb) - Comments per week
- `pcp_params` - data (jsonb) - Suggestion algorithm parameters
- `pcp_coverage` - data (jsonb) - Imported coverage Excel data
- `pcp_notes` - week_key (unique), notes (text) - SKU notes per week

## Week System
- 9 weeks displayed: current week (PCP1) + 8 future weeks (PCP2-PCP9)
- ISO week keys: e.g. `2026-W09`, `2026-W10`, etc.
- Server returns `expectedWeeks` array with current 9 week keys
- Data stored per week in pcp_states table with week_key as identifier

## Sequential Stock Projection Engine
- Centralized projection in `pcp.html`: `calcularProjecaoCompleta()`, `calcularEstoqueSemana()`, `getEstoqueProjetadoParaSemana()`
- Formula: `EstoqueFinal = max(0, EstoqueInicial + Produção - VendaPrevista)`
- PCP1 (current week) uses real stock from spreadsheet; PCP2+ uses projected final stock from confirmed prior week
- Week confirmation buttons appear in both Alert Center and Coverage Chart (shared `_alertCheckedWeeks` Set)
- Buttons synced: checking in one panel auto-updates the other
- Sequential only: can't confirm PCP3 without confirming PCP2 first; can't unconfirm PCP1 if PCP2 is confirmed
- Weeks without production shown as disabled/dashed
- `getWeekData()` reads from `pcpState.weeks` (not localStorage) for cross-device consistency
- `buildSuggestion()` uses `getEstoqueProjetadoParaSemana()` to get projected stock for current week before generating suggestions
- `buildAlertProjectionByWeeks()` uses `calcularProjecaoCompleta()` for timeline projection
- Coverage chart bars update to show projected stock when weeks are confirmed

## Priority Score Engine (Suggestion Motor Analítico)
- Each product gets a numeric score (0-100) composed of 3 weighted components:
  - **Ruptura** (default 40%): risk of stockout — max score if projected stock ≤ 0, scales with gap and coverage
  - **Giro** (default 25%): demand/sales volume relative to portfolio maximum
  - **DistMeta** (default 35%): distance from target coverage (metaDias)
- Weights configurable by admin in Parâmetros overlay (`pesoRuptura`, `pesoGiro`, `pesoDistMeta`)
- **Teto de Autonomia** (`tetoAutonomia`, default 55 days): products above this threshold get score=0 and `precisaProd=false`
- Products sorted by `scoreFinal` descending for allocation priority
- Score visible in: Suggestion modal (explainability table), Análise PCP panel (full ranking)

## Análise PCP Panel
- Accessed via purple "Análise PCP" button in subbar (enabled after coverage upload)
- Sections: Summary stats → Capacity usage per line → Capacity alerts → Rupture alerts → Full ranking table
- Shows score breakdown bars (red=ruptura, blue=giro, yellow=distMeta) per product
- Capacity usage shows days occupied / total (5) with progress bars for lines A/B, C, K
- Products that need production but couldn't be allocated shown as "Capacity Insufficient" alerts

## Auth
- Default admin: `admin` / `admin123` (auto-created on first boot)
- Admin users can edit PCP and save
- Non-admin users see read-only view (can switch weeks, cannot edit)
- Guest mode: visitors can view without login (no edit access)
- Tokens stored in PostgreSQL `auth_tokens` table with 30-day expiry
- Token sent via `Authorization: Bearer <token>` header from frontend
- Token stored in `localStorage` (key: `auth_token`) to work in iframe environments

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (required)
- `SESSION_SECRET` - Not used anymore (was for cookie sessions)
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - "development" or "production"

## Commands
- `npm run dev` - Start dev server (frontend + backend)
- `npm run build` - Build for production (outputs to dist/)
- `npm start` - Start production server
- `npm run db:push` - Push schema to database
