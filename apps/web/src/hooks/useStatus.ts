import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

export function useActiveStatusRooms() {
  return useQuery<string[]>({
    queryKey: ["status", "active-rooms"],
    queryFn: async () => {
      const data = await api<{ roomIds: string[] }>("/status-active");
      return data.roomIds;
    },
    refetchInterval: 60_000,
  });
}

export function useRoomStatuses(slug: string) {
  return useQuery<{ statuses: import("@/services/types").RoomStatus[] }>({
    queryKey: ["status", slug],
    queryFn: () => api(`/rooms/${slug}/status`),
    enabled: Boolean(slug),
  });
}
