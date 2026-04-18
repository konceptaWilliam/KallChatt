import { router } from "./trpc";
import { groupsRouter } from "./routers/groups";
import { threadsRouter } from "./routers/threads";
import { messagesRouter } from "./routers/messages";
import { invitesRouter } from "./routers/invites";
import { workspaceRouter } from "./routers/workspace";
import { membersRouter } from "./routers/members";
import { onboardingRouter } from "./routers/onboarding";
import { profileRouter } from "./routers/profile";
import { searchRouter } from "./routers/search";

export const appRouter = router({
  groups: groupsRouter,
  threads: threadsRouter,
  messages: messagesRouter,
  invites: invitesRouter,
  workspace: workspaceRouter,
  members: membersRouter,
  onboarding: onboardingRouter,
  profile: profileRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;
