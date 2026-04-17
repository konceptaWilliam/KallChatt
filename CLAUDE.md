# Kallchatt

A web-based team messenger. Radical simplicity — threads in groups, each with a visible OPEN/URGENT/DONE status. No DMs, no channels.

## Stack

- **Next.js 14** App Router, TypeScript strict mode
- **tRPC v11** with superjson + React Query v5
- **Supabase** — Postgres, Auth (password login + magic link), Realtime, Storage
- **Tailwind CSS** — custom design tokens (ink/surface/muted/border)
- **Resend** — transactional email (invite emails)

## Key files

| File | Purpose |
|------|---------|
| `lib/trpc/router.ts` | Merged AppRouter — groups, threads, messages, invites, workspace, members, onboarding, profile |
| `lib/trpc/trpc.ts` | tRPC init — `publicProcedure`, `protectedProcedure`, `adminProcedure` |
| `lib/trpc/context.ts` | tRPC context: Supabase session → user + profile |
| `lib/supabase/client.ts` | Browser Supabase client (`createBrowserClient`) |
| `lib/supabase/server.ts` | Server Supabase client (`createServerClient` + cookies) |
| `lib/supabase/admin.ts` | Service-role client — bypasses RLS, used in all tRPC mutations |
| `middleware.ts` | Session refresh + auth guard. Public paths: `/login`, `/auth/callback`, `/invite`, `/api/trpc` |
| `supabase/migrations/001_initial_schema.sql` | Full schema + RLS policies + helper functions |
| `app/auth/callback/route.ts` | Handles magic link callback, invite token acceptance, new vs existing user routing |
| `app/page.tsx` | Root redirect — checks profile (admin client), routes to first group or onboarding |
| `components/thread-detail.tsx` | Real-time messages via Supabase Realtime |
| `components/thread-list.tsx` | Real-time thread status updates |

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Supabase setup

1. Run `supabase/migrations/001_initial_schema.sql` in the SQL editor
2. Enable Realtime on `messages` and `threads` tables (Dashboard → Database → Replication)
3. Create a **public** Storage bucket named `avatars`
4. Run these storage policies in the SQL editor:
   ```sql
   CREATE POLICY "avatar upload" ON storage.objects
     FOR INSERT TO authenticated
     WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

   CREATE POLICY "avatar update" ON storage.objects
     FOR UPDATE TO authenticated
     USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

   CREATE POLICY "avatar read" ON storage.objects
     FOR SELECT TO public
     USING (bucket_id = 'avatars');
   ```

## Auth flow

- **Login:** Email + password via `supabase.auth.signInWithPassword`
- **Invite:** Admin sends invite → recipient gets email with `/invite/[token]` link → magic link OTP sent → `/auth/callback?inviteToken=...` → onboarding (new user) or direct accept (existing user)
- **Onboarding:** New users set display name → `trpc.onboarding.complete` creates workspace + profile

## Architecture notes

- **All tRPC mutations use `createAdminClient()`** to bypass RLS. User client is only used for auth checks.
- `my_workspace_id()` and `is_group_member()` are SECURITY DEFINER SQL functions used in RLS policies.
- `adminProcedure` checks `profile.role === 'ADMIN'` — only admins can invite, create groups, manage workspace.
- Resend `from` address must be a verified domain in production. For dev/testing use `onboarding@resend.dev`.
- Supabase free tier: 3 OTP emails/hour per project.

## Known pending items

- Avatar upload storage policies need to be applied in Supabase (see setup above) — currently getting RLS error on upload
- Debug log in `app/page.tsx` (console.log on line ~21) should be removed once stable
