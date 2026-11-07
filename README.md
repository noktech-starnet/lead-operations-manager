# Lead Operations Manager

The existing Spanish interface, import/cleaning/export tools, client directory, distributions, deliveries, reports and reconciliations now use Supabase for durable shared storage and email/password authentication.

## Run locally

Use Node 24+, `npm ci`, copy `.env.example` to `.env.local`, set the **public** Supabase URL and publishable key, then `npm run dev`. Run `npm run lint`, `npm run build`, and `npm run test:e2e`. Browser tests use Chromium at `/usr/bin/chromium`; override `CHROMIUM_PATH` when needed. Start the dev server before running them.

Never put a service-role key, database password, SMTP password, or other private credential in `VITE_*` variables. Vite embeds those values in the browser. `.env.local`, `.vercel`, browser traces and test output are ignored by Git.

## Database and authorization

The baseline SQL is in `supabase/migrations/`. It creates a shared workspace, verified-email invitations, user profiles, memberships, business records, immutable database audit events, and idempotency receipts. `app_records` stores each business object in its own row, with its original fields in JSONB to preserve the prototype's existing calculations and exports. Composite keys isolate workspaces and record versions prevent stale overwrites. Related writes use one transaction, and retries use the same request identifier.

RLS is enabled on every application table. Authorization uses server-owned membership rows, never editable user metadata or the interface's role selector. Unapproved signups have no team access. The initial administrator invitation is reserved for the email chosen during setup and only activates after email confirmation. No password is created by the migration.

| Role | Read | Write |
| --- | --- | --- |
| Administrator | Workspace records, team access, database audit | All business records; authorize/suspend other members |
| Distribution | Workspace business records | Leads, batches, clients, deliveries, distributions, reports, import mappings |
| Reconciliation | Workspace business records | Reconciliation results |

The role selector only changes the current working view; it never grants permissions. All roles may append activity notes. Database audit events record the actual authenticated actor and old/new versions automatically, with no client write/delete grants. Reports can still be corrected as in the prototype; previous versions remain in the database audit. Reset and restore operations also leave audit history intact.

`tests/authorization.sql` exercises real Postgres policies, verified invitations, privilege escalation attempts, immediate suspension, immutable audit, atomic rollback, conflict detection and retry idempotency. Fixtures are rolled back. `tests/interface.spec.ts` exercises UI sign-up/sign-in/sign-out, saving, refreshing and retry behavior against a simulated API; it does **not** claim to test live email delivery.

## First use and existing browser data

1. Create the administrator account using the reserved email and a password of at least 12 characters, then confirm its email.
2. Sign in. The original default catalogs, goals, example clients and example distributions are initialized once for the workspace. Sample leads remain optional under the original demonstration button.
3. In Configuración & Histórico, use Acceso del equipo to authorize additional emails and assign roles. This records authorization; it does not send an invitation email. Each person creates and verifies their own account.
4. Existing prototype data is never silently uploaded. The administrator can export a backup, then explicitly import JSON or import data from the same browser under settings. Import replaces matching business IDs. Browser storage belongs to an origin: a new Vercel address cannot read data from a different address. Export a backup from the original address first.
5. Saving status remains visible. If a save cannot be confirmed, retry before leaving. Conflicts require discarding the local change, refreshing, and applying it again. Business data is held in memory rather than stored in browser local storage. Supabase persists the signed-in session in its own auth storage; sign-out clears the app's memory.

## Authentication email and deployment

Set Supabase Auth Site URL to the production address and allow the exact preview/production redirect addresses. Email confirmation stays enabled. Configure a production SMTP sender in Supabase before opening registration to users outside the Supabase organization: the built-in sender is restricted and rate limited. SMTP credentials belong in Supabase's settings, never the website or repository.

Vercel uses `vercel.json` (`npm ci`, Vite build, `dist`). Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` separately in Preview and Production. Review the feature branch and preview before publishing. Preview and production currently target the same explicitly approved empty Supabase project; use a separate project for future untrusted development/testing.

The old Firebase blueprint and Firestore rules remain as prototype reference files; this application does not connect to Firestore. Supabase is the live storage backend.
