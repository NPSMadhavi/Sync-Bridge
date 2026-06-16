import { queryClient } from "@/lib/queryClient";

/** Refetch header bell notifications immediately after creating a reminder. */
export async function refreshNotificationQueries(): Promise<void> {
  await queryClient.refetchQueries({ queryKey: ["/api/notifications"] });
}
