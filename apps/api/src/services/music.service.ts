import YTMusic from "ytmusic-api";

let yt: YTMusic | null = null;
async function getYt() {
  if (!yt) { yt = new YTMusic(); await yt.initialize(); }
  return yt;
}

const CACHE_MIN = 30;
const cache = new Map<string, { data: unknown; expires: number }>();

function cached<T>(key: string, fn: () => Promise<T>, ttlMs = 1000 * 60 * CACHE_MIN): Promise<T> {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return Promise.resolve(entry.data as T);
  return fn().then((data) => { cache.set(key, { data, expires: Date.now() + ttlMs }); return data; });
}

const DZ = "https://api.deezer.com";

async function dzFetch(path: string) {
  const res = await fetch(`${DZ}${path}`);
  if (!res.ok) throw new Error(`Deezer ${res.status}: ${path}`);
  return res.json();
}

/* Home */
export async function getHomeSections() {
  return cached("dz_home_v2", async () => {
    const [tracksRes, albumsRes, chartTracks] = await Promise.all([
      dzFetch("/chart/0/tracks?limit=10"),
      dzFetch("/chart/0/albums?limit=10"),
      dzFetch("/chart/0/tracks?limit=50"),
    ]);

    const genres = await dzFetch("/genre");
    const genreSections = await Promise.all(
      genres.data.slice(0, 6).map(async (g: any) => {
        try {
          const r = await dzFetch(`/genre/${g.id}/artists?limit=6`);
          return { title: g.name, contents: (r.data ?? []).map((a: any) => ({
              type: "artist" as const, id: String(a.id), name: a.name,
              thumbnail: a.picture_medium ?? `https://api.deezer.com/artist/${a.id}/image`,
              trackCount: a.nb_album,
            })) };
        } catch {
          return null;
        }
      })
    );

    return [
      { title: "Top Brasil", contents: (tracksRes.data ?? []).map((t: any) => ({
        type: "song" as const, id: String(t.id), name: t.title || t.title_short,
        artist: t.artist?.name, artistId: String(t.artist?.id ?? ""),
        album: t.album?.title, duration: t.duration,
        thumbnail: t.album?.cover_medium ?? t.artist?.picture_medium ?? (t.artist?.id ? `https://api.deezer.com/artist/${t.artist.id}/image` : null),
        previewUrl: t.preview,
      })) },
      { title: "Novos albuns", contents: (albumsRes.data ?? []).map((a: any) => ({
        type: "album" as const, id: String(a.id), name: a.title,
        artist: a.artist?.name, thumbnail: a.cover_medium ?? `https://api.deezer.com/album/${a.id}/image`,
        trackCount: a.nb_tracks,
      })) },
      { title: "Tendencias", contents: (chartTracks.data ?? []).slice(0, 10).map((t: any) => ({
        type: "song" as const, id: String(t.id), name: t.title || t.title_short,
        artist: t.artist?.name, artistId: String(t.artist?.id ?? ""),
        album: t.album?.title, duration: t.duration,
        thumbnail: t.album?.cover_medium ?? t.artist?.picture_medium ?? (t.artist?.id ? `https://api.deezer.com/artist/${t.artist.id}/image` : null),
        previewUrl: t.preview,
      })) },
      ...genreSections.filter(Boolean),
    ];
  });
}

/* Search */
export async function searchAll(q: string) {
  return cached(`dz_search_${q}`, async () => {
    const [tracks, artists, albums] = await Promise.all([
      dzFetch(`/search/track?q=${encodeURIComponent(q)}&limit=10`),
      dzFetch(`/search/artist?q=${encodeURIComponent(q)}&limit=5`),
      dzFetch(`/search/album?q=${encodeURIComponent(q)}&limit=5`),
    ]);
    return [
      ...(tracks.data ?? []).map((t: any) => ({
        type: "song" as const, id: String(t.id), name: t.title || t.title_short, artist: t.artist?.name, artistId: String(t.artist?.id ?? ""),
        album: t.album?.title, duration: t.duration,
        thumbnail: t.album?.cover_medium ?? t.artist?.picture_medium ?? (t.artist?.id ? `https://api.deezer.com/artist/${t.artist.id}/image` : null),
        previewUrl: t.preview,
      })),
      ...(albums.data ?? []).map((a: any) => ({
        type: "album" as const, id: String(a.id), name: a.title, artist: a.artist?.name,
        thumbnail: a.cover_medium ?? `https://api.deezer.com/album/${a.id}/image`, trackCount: a.nb_tracks,
      })),
      ...(artists.data ?? []).map((a: any) => ({
        type: "artist" as const, id: String(a.id), name: a.name,
        thumbnail: a.picture_medium ?? `https://api.deezer.com/artist/${a.id}/image`, trackCount: a.nb_album,
      })),
    ];
  });
}

/* Album */
export async function getAlbum(albumId: string) {
  return cached(`dz_album_${albumId}`, async () => {
    const album = await dzFetch(`/album/${albumId}`);
    return (album.tracks?.data ?? []).map((t: any) => ({
      type: "song" as const, id: String(t.id), name: t.title || t.title_short, artist: t.artist?.name, artistId: String(t.artist?.id ?? ""),
      album: album.title, duration: t.duration,
      thumbnail: album.cover_medium ?? t.artist?.picture_medium ?? (t.artist?.id ? `https://api.deezer.com/artist/${t.artist.id}/image` : null),
      previewUrl: t.preview,
    }));
  });
}

/* Artist: top songs + albums */
export async function getArtistData(artistId: string) {
  return cached(`dz_artist_full_${artistId}`, async () => {
    const [top, albums] = await Promise.all([
      dzFetch(`/artist/${artistId}/top?limit=20`),
      dzFetch(`/artist/${artistId}/albums`),
    ]);
    return {
      songs: (top.data ?? []).map((t: any) => ({
        type: "song" as const, id: String(t.id), name: t.title || t.title_short, artist: t.artist?.name, artistId: String(t.artist?.id ?? ""),
        album: t.album?.title, duration: t.duration,
        thumbnail: t.album?.cover_medium ?? t.artist?.picture_medium ?? (t.artist?.id ? `https://api.deezer.com/artist/${t.artist.id}/image` : null),
        previewUrl: t.preview,
      })),
      albums: (albums.data ?? []).map((a: any) => ({
        type: "album" as const, id: String(a.id), name: a.title, artist: a.artist?.name,
        thumbnail: a.cover_medium ?? `https://api.deezer.com/album/${a.id}/image`, trackCount: a.nb_tracks,
      })),
    };
  });
}

/* Get YouTube videoId from Deezer track data */
export async function getYouTubeId(trackName: string, artistName: string): Promise<string | null> {
  try {
    const y = await getYt();
    const query = `${trackName} ${artistName}`;
    const results = await y.searchSongs(query);
    return results?.[0]?.videoId ?? null;
  } catch {
    return null;
  }
}

/* Mappers - kept for backward compatibility, no longer used internally */
function mapDzTrack(t: any, albumName?: string, albumCover?: string) {
  const artistId = t.artist?.id;
  return {
    type: "song" as const,
    id: String(t.id),
    name: t.title || t.title_short,
    artist: t.artist?.name,
    artistId: String(artistId ?? ""),
    album: albumName ?? t.album?.title,
    duration: t.duration,
    thumbnail: albumCover ?? t.album?.cover_medium ?? t.artist?.picture_medium ?? (artistId ? `https://api.deezer.com/artist/${artistId}/image` : null),
    previewUrl: t.preview,
  };
}

function mapDzAlbum(a: any) {
  return {
    type: "album" as const,
    id: String(a.id),
    name: a.title,
    artist: a.artist?.name,
    thumbnail: a.cover_medium ?? a.cover_big ?? a.cover_small ?? a.cover ?? `https://api.deezer.com/album/${a.id}/image`,
    trackCount: a.nb_tracks,
  };
}

function mapDzArtist(a: any) {
  return {
    type: "artist" as const,
    id: String(a.id),
    name: a.name,
    thumbnail: a.picture_medium ?? a.picture_big ?? a.picture_small ?? a.picture ?? `https://api.deezer.com/artist/${a.id}/image`,
    trackCount: a.nb_album,
  };
}