import { useEffect } from "react";
import { registerForPushNotifications } from "@/lib/notifications";
import { trpc } from "@/lib/trpc";

export function usePushToken() {
  const savePushToken = trpc.profile.savePushToken.useMutation();

  useEffect(() => {
    registerForPushNotifications().then((token) => {
      if (token) savePushToken.mutate({ token });
    });
  }, []);
}
