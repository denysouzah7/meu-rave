import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

export type MusicItem = {
  type: "song" | "artist" | "album" | "playlist";
  videoId?: string;
  name: string;
  artist?: string;
  artistId?: string;
  album?: string;
  duration?: number;
  thumbnail?: string | null;
  playlistId?: string;
  albumId?: string;
};

export function useAlbumSongs(albumId: string) {
  return useQuery<{ songs: MusicItem[] }>({
    queryKey: ["music", "album", albumId],
    queryFn: () => api(`/music/album/${albumId}/songs`),
    enabled: Boolean(albumId),
  });
}

export type HomeSection = {
  title: string;
  contents: MusicItem[];
};

export function useMusicHome() {
  return useQuery<{ sections: HomeSection[] }>({
    queryKey: ["music", "home"],
    queryFn: () => api("/music/home"),
    refetchInterval: 1000 * 60 * 30,
  });
}

export function useMusicSearch(query: string) {
  return useQuery<{ results: MusicItem[] }>({
    queryKey: ["music", "search", query],
    queryFn: () => api(`/music/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 0,
  });
}

export function useMusicPlaylist(playlistId: string, name?: string) {
  return useQuery<{ songs: MusicItem[] }>({
    queryKey: ["music", "playlist", playlistId],
    queryFn: () => api(`/music/playlist/${playlistId}?name=${encodeURIComponent(name ?? "")}`),
    enabled: Boolean(playlistId),
  });
}