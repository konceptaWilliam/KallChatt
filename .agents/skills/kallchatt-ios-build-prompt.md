# Kallchatt — iOS App Store Build Prompt

## Context

Kallchatt is a thread-based team messenger for small teams. The web app is already built and live. You are building the **iOS mobile app** as a new client that shares the same backend — the same Supabase database, the same tRPC API, and the same auth system. You are NOT rebuilding the backend. You are NOT changing the database schema. You are a new frontend consuming an existing API.

The philosophy of Kallchatt: radical simplicity. Groups → Threads → Messages. Every thread has a status (OPEN, URGENT, DONE). No DMs. No noise.

---

## What already exists (do not rebuild)

- Supabase project with all tables, RLS policies, and Auth configured
- tRPC API deployed on Vercel (all procedures listed below)
- Resend invite email flow
- Web app at `apps/web` (Next.js 14)

The monorepo structure you are working in:

```
apps/
  web/          ← existing Next.js app (do not touch)
  mobile/       ← YOU ARE BUILDING THIS
packages/
  core/         ← shared Supabase client, tRPC client, TypeScript types, Zod schemas
```

If `packages/core` does not exist yet, create it and extract the shared logic from the web app. If it already exists, import from it directly.

---

## Stack

- **Framework**: Expo SDK 51 with Expo Router (file-based navigation)
- **Language**: TypeScript strict mode
- **Styling**: NativeWind v4 (Tailwind CSS for React Native)
- **API**: tRPC client from `packages/core` — same procedures as the web app
- **Auth**: Supabase Auth via `@supabase/supabase-js` + `expo-auth-session` for magic link deep links
- **Session storage**: `expo-secure-store` (NOT AsyncStorage — must be encrypted)
- **Realtime**: Supabase Realtime via the shared Supabase client
- **Push notifications**: `expo-notifications` + Expo Push API (server-side via tRPC)
- **Navigation**: Expo Router with typed routes
- **Builds**: EAS Build (development, preview, production profiles)

---

## tRPC procedures available (shared backend)

These procedures already exist. Call them from the mobile app exactly as the web app does.

```
groups.list          — list groups for the current user
threads.list(groupId) — list threads for a group
threads.create(groupId, title) — create a thread
threads.updateStatus(threadId, status) — OPEN | URGENT | DONE
messages.list(threadId) — list messages (limit 50, paginated)
messages.send(threadId, body) — send a message
invites.send(email, groupIds) — admin only
workspace.get — get current workspace
members.list — admin only
```

---

## File structure for `apps/mobile`

```
apps/mobile/
  app/
    (auth)/
      login.tsx         ← magic link email entry screen
      onboarding.tsx    ← display name setup for new users
    (app)/
      (tabs)/
        index.tsx       ← groups list tab
        settings.tsx    ← profile + sign out tab
      group/
        [groupId].tsx   ← thread list for a group
      thread/
        [threadId].tsx  ← thread detail + chat
    _layout.tsx         ← root layout, auth guard
    +not-found.tsx
  components/
    ThreadItem.tsx
    MessageBubble.tsx
    StatusControl.tsx
    GroupItem.tsx
  hooks/
    useRealtimeMessages.ts
    useRealtimeThreadStatus.ts
  lib/
    notifications.ts    ← push token registration
  assets/
    icon.png            ← 1024×1024 PNG, no alpha channel, no rounded corners
    splash.png
  app.json
  eas.json
  babel.config.js
  tailwind.config.js
```

---

## Authentication flow

### Magic link login (`app/(auth)/login.tsx`)

1. Screen shows the Kallchatt wordmark, a single email input, and a "Send link" button
2. On submit: call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: 'kallchatt://auth/callback' } })`
3. Show "Check your email" confirmation state — no spinner, no redirect yet
4. The deep link `kallchatt://auth/callback` is handled by Expo Router's `app/auth/callback.tsx`
5. In the callback route: call `supabase.auth.getSessionFromUrl(url)`, store the session in `expo-secure-store`, then redirect

### New user onboarding (`app/(auth)/onboarding.tsx`)

- Shown after first login if `profile` does not exist for the user's `auth.users` UUID
- Single screen: display name input + "Let's go" button
- On submit: call `tRPC.workspace.get` to get workspace info, then `supabase.from('profiles').insert(...)`, then `tRPC.invites.accept` if a pending invite exists for the user's email
- Redirect to `/(app)/(tabs)/`

### Auth guard (`app/_layout.tsx`)

- On mount: check `supabase.auth.getSession()` from `expo-secure-store`
- No session → redirect to `/(auth)/login`
- Session, no profile → redirect to `/(auth)/onboarding`
- Session + profile → render the app

---

## Screen specifications

### Groups tab (`app/(app)/(tabs)/index.tsx`)

- Header: workspace name (fetched from `tRPC.workspace.get`)
- Body: `FlatList` of groups from `tRPC.groups.list`
- Each group item: group name, unread indicator (simple dot — can be static for MVP)
- Tap → navigate to `/(app)/group/[groupId]`
- Empty state: "No groups yet. Ask your admin to add you to one."
- Pull-to-refresh

### Thread list (`app/(app)/group/[groupId].tsx`)

Sort order:
1. URGENT threads — amber left border (3px), sorted by `updated_at` desc
2. OPEN threads — sorted by `updated_at` desc
3. DONE threads — 40% opacity, sorted by `updated_at` desc

Each thread item shows:
- Thread title (truncated at 1 line)
- Status badge (see badge spec below)
- Last message body preview (1 line, truncated, gray)
- Relative timestamp ("2m ago", "Yesterday")

Header right button: "+" → opens new thread bottom sheet

New thread bottom sheet (`@gorhom/bottom-sheet`):
- Title input (auto-focused)
- "Create" button → calls `tRPC.threads.create`, closes sheet, thread appears at top of list
- Sheet snaps to 40% height

Pull-to-refresh. `FlatList` with `keyExtractor={item => item.id}`.

### Thread detail (`app/(app)/thread/[threadId].tsx`)

Header:
- Back button (left)
- Thread title (truncated, center)
- No overflow menu in MVP

Below header: status control (see spec below)

Messages:
- `FlatList` with `inverted={true}` — newest at bottom, list renders from bottom up
- Each message: avatar circle (initials), display name, body text, timestamp
- Auto-scroll to bottom on new message (call `flatListRef.current?.scrollToOffset({ offset: 0 })` since list is inverted)
- Paginate: load 50 most recent on mount. Load more on scroll-to-top (call `tRPC.messages.list` with cursor).

Message input (pinned to bottom):
```tsx
<KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight}>
  <View style={{ flexDirection: 'row', padding: 12, gap: 8 }}>
    <TextInput
      multiline
      placeholder="Message..."
      value={body}
      onChangeText={setBody}
      style={{ flex: 1, maxHeight: 120 }}
    />
    <Pressable onPress={handleSend} disabled={!body.trim()}>
      <SendIcon />
    </Pressable>
  </View>
</KeyboardAvoidingView>
```

Send on button tap. Clear input after send. Optimistic: append message to list immediately before server confirms.

Real-time: on mount, subscribe to `messages` inserts filtered by `thread_id`. On new message event, prepend to the inverted list. Unsubscribe on unmount.

### Status control (`components/StatusControl.tsx`)

A horizontal row of three tappable pills:

```
[ OPEN ]  [ URGENT ]  [ DONE ]
```

Styles:
- Inactive: gray background, gray text, 0.5px border
- OPEN active: blue background, blue text
- URGENT active: amber background, amber-dark text, slightly larger font
- DONE active: green background, green-dark text

On tap: call `tRPC.threads.updateStatus` optimistically — update local state immediately, revert on error.

Real-time: subscribe to `threads` updates for this `thread_id`. Update local status badge when another user changes it.

Minimum touch target: 44×44pt on each pill.

### Settings tab (`app/(app)/(tabs)/settings.tsx`)

- Display name (editable inline — tap to edit, blur to save)
- Email (read-only)
- Workspace name (read-only)
- "Invite someone" → opens invite sheet (admin only — hide for non-admins)
- "Sign out" button → calls `supabase.auth.signOut()`, clears `expo-secure-store`, redirects to login
- App version (from `expo-constants`)

---

## Status badge spec

Used in thread list items and as the active state of the status control.

| Status | Background | Text color | Border |
|--------|-----------|------------|--------|
| OPEN | `#E6F1FB` | `#0C447C` | `#85B7EB` |
| URGENT | `#FAEEDA` | `#633806` | `#EF9F27` |
| DONE | `#EAF3DE` | `#27500A` | `#97C459` |

In thread list: URGENT items also have a `borderLeftWidth: 3, borderLeftColor: '#EF9F27'` on the row container. `borderRadius: 0` on the left side when using a left border.

---

## Push notifications

### Registration (`lib/notifications.ts`)

```typescript
import * as Notifications from 'expo-notifications';

export async function registerForPushNotifications(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  return token;
}
```

Call this on app launch (after auth). Save the returned token to `profiles.push_token` via a tRPC mutation.

### Notification handler

Set at app root:
```typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
```

### Notification tap — deep link

```typescript
Notifications.addNotificationResponseReceivedListener(response => {
  const threadId = response.notification.request.content.data?.threadId;
  if (threadId) router.push(`/thread/${threadId}`);
});
```

### Server-side push (add to existing `messages.send` tRPC procedure)

After inserting the message, fetch push tokens for all group members except the sender, then call the Expo Push API:

```typescript
const messages = tokens.map(token => ({
  to: token,
  title: senderName,
  body: messageBody.slice(0, 100),
  data: { threadId },
}));
await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(messages),
});
```

---

## EAS configuration (`eas.json`)

```json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "buildConfiguration": "Release" }
    },
    "production": {
      "ios": { "buildConfiguration": "Release" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@apple.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

---

## App Store requirements checklist

Complete all of these before submitting for review:

**Assets**
- [ ] App icon: 1024×1024 PNG, no alpha channel, no rounded corners (Apple applies the mask)
- [ ] Splash screen: centered wordmark on off-white background (`#F7F6F2`)
- [ ] Screenshots for 6.7" (iPhone 15 Pro Max): minimum 3, showing groups, thread list, and thread chat
- [ ] Screenshots for 5.5" (iPhone 8 Plus): minimum 3

**App Store Connect metadata**
- [ ] App name: Kallchatt
- [ ] Subtitle (max 30 chars): "Team threads, simply."
- [ ] Description (max 4000 chars): explain the groups → threads → status system; emphasize simplicity
- [ ] Keywords (max 100 chars): team, chat, threads, messenger, groups, work, simple
- [ ] Support URL: link to a support page or email
- [ ] Privacy Policy URL: required — must exist before submission
- [ ] Age rating: complete the questionnaire (no objectionable content → 4+)

**Privacy labels** (required in App Store Connect)
- Contact info: email address (used for login, linked to user)
- Identifiers: user ID (linked to user)
- Usage data: product interaction (not linked)

**Review notes**
- Provide a demo account: email + the magic link already clicked (or a test account with a pre-set session)
- Explain the magic link flow so the reviewer isn't confused by passwordless auth

---

## Design direction

Carry the web app's aesthetic to mobile. The look is **utilitarian minimalism** — a well-made tool, not a marketing product.

- **Background**: `#F7F6F2` (off-white) for all screen backgrounds
- **Text**: `#1A1A18` (charcoal) primary, `#888780` secondary
- **Borders/separators**: `#E2E0D8` (1px)
- **Accent**: amber `#D97706` for URGENT states and interactive highlights
- **Typography**: Use the system font (`-apple-system`) for all body text on iOS — do not import custom fonts. Thread titles may use a monospaced variant (`'Courier New'` or system mono) for visual identity.
- **Density**: compact but breathable. List rows 64pt tall. Message rows 12pt vertical padding.
- **DONE threads**: `opacity: 0.4` in the thread list — they visually recede.
- **URGENT threads**: amber left border + amber badge — should feel genuinely attention-grabbing.

Do not use: heavy shadows, glassmorphism, saturated colored backgrounds, card carousels, or any pattern that looks like a generic productivity app template.

---

## Out of scope for this build

- Android (iOS first; Android follows the same codebase with minor adjustments)
- File or image attachments
- Direct messages
- Thread search
- Read receipts or unread counts
- Multiple workspaces per user
- OAuth login (Google, GitHub)
- iPad-specific layout
