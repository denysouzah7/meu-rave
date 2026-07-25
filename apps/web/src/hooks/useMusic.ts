import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

export type MusicItem = {
  type: "song" | "artist" | "album";
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  album?: string;
  duration?: number;
  thumbnail?: string | null;
  previewUrl?: string;
  videoId?: string;
  trackCount?: number;
};

export type HomeSection = {
  title: string;
  contents: MusicItem[];
};

export function useMusicHome() {
  return useQuery<{ sections: HomeSection[] }>({
    queryKey: ["music", "home"],
    queryFn: () => api("/music/home"),
    staleTime: 1000 * 60 * 30,
  });
}

export function useMusicSearch(query: string) {
  return useQuery<{ results: MusicItem[] }>({
    queryKey: ["music", "search", query],
    queryFn: () => api(`/music/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 0,
  });
}

export function useAlbum(id: string) {
  return useQuery<{ songs: MusicItem[] }>({
    queryKey: ["music", "album", id],
    queryFn: () => api(`/music/album/${id}`),
    enabled: Boolean(id),
  });
}

export function useArtistTop(id: string) {
  return useQuery<{ songs: MusicItem[] }>({
    queryKey: ["music", "artist", id],
    queryFn: () => api(`/music/artist/${id}/top`),
    enabled: Boolean(id),
  });
}

export function useYouTubeId(name: string, artist: string) {
  return useQuery<{ videoId: string | null }>({
    queryKey: ["music", "ytid", name, artist],
    queryFn: () => api(`/music/youtube-id?name=${encodeURIComponent(name)}&artist=${encodeURIComponent(artist)}`),
    enabled: Boolean(name),
  });
}