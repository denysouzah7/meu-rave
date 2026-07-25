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
  return cached("dz_home", async () => {
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
          return { title: g.name, contents: (r.data ?? []).map(mapDzArtist) };
        } catch {
          return null;
        }
      })
    );

    return [
      { title: "Top Brasil", contents: (tracksRes.data ?? []).map(mapDzTrack) },
      { title: "Novos albuns", contents: (albumsRes.data ?? []).map(mapDzAlbum) },
      { title: "Tendencias", contents: (chartTracks.data ?? []).slice(0, 10).map(mapDzTrack) },
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
      ...(tracks.data ?? []).map(mapDzTrack),
      ...(albums.data ?? []).map(mapDzAlbum),
      ...(artists.data ?? []).map(mapDzArtist),
    ];
  });
}

/* Album */
export async function getAlbum(albumId: string) {
  return cached(`dz_album_${albumId}`, async () => {
    const album = await dzFetch(`/album/${albumId}`);
    return (album.tracks?.data ?? []).map((t: any) => mapDzTrack(t, album.title, album.cover_medium));
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
      songs: (top.data ?? []).map(mapDzTrack),
      albums: (albums.data ?? []).map(mapDzAlbum),
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

/* Convert multiple tracks at once */
export async function getYouTubeIds(tracks: { name: string; artist: string }[]): Promise<Record<number, string | null>> {
  const result: Record<number, string | null> = {};
  await Promise.all(tracks.map(async (t, i) => {
    result[i] = await getYouTubeId(t.name, t.artist);
  }));
  return result;
}

/* Mappers */
function mapDzTrack(t: any, albumName?: string, albumCover?: string) {
  return {
    type: "song" as const,
    id: String(t.id),
    name: t.title || t.title_short,
    artist: t.artist?.name,
    artistId: String(t.artist?.id ?? ""),
    album: albumName ?? t.album?.title,
    duration: t.duration,
    thumbnail: albumCover ?? t.album?.cover_medium ?? t.album?.cover_big ?? t.album?.cover_small ?? t.album?.cover ?? t.artist?.picture_medium ?? t.artist?.picture_big ?? t.artist?.picture_small ?? t.artist?.picture ?? null,
    previewUrl: t.preview,
  };
}

function mapDzAlbum(a: any) {
  return {
    type: "album" as const,
    id: String(a.id),
    name: a.title,
    artist: a.artist?.name,
    thumbnail: a.cover_medium ?? a.cover_big ?? a.cover_small ?? a.cover ?? null,
    trackCount: a.nb_tracks,
  };
}

function mapDzArtist(a: any) {
  return {
    type: "artist" as const,
    id: String(a.id),
    name: a.name,
    thumbnail: a.picture_medium ?? a.picture_big ?? a.picture_small ?? a.picture ?? null,
    trackCount: a.nb_album,
  };
}