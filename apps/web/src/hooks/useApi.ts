import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { Room, RoomPayload, StickerPack, User } from "@/services/types";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User }>("/me"),
    retry: false,
  });
}

export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: () => api<{ rooms: Room[] }>("/rooms"),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useRoom(slug: string) {
  return useQuery({
    queryKey: ["room", slug],
    queryFn: () => api<RoomPayload>(`/rooms/slug/${slug}`),
    enabled: Boolean(slug),
  });
}

export function useStickerPacks() {
  return useQuery({
    queryKey: ["stickers", "packs"],
    queryFn: () => api<{ packs: StickerPack[] }>("/stickers/packs"),
  });
}

export function useInvalidate() {
  const queryClient = useQueryClient();
  return (key: readonly unknown[]) =>
    queryClient.invalidateQueries({ queryKey: key });
}
