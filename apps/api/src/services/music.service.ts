import YTMusic from "ytmusic-api";

let ytmusic: YTMusic | null = null;

async function getYt() {
  if (!ytmusic) {
    ytmusic = new YTMusic();
    await ytmusic.initialize();
  }
  return ytmusic;
}

let cache = new Map<string, { data: unknown; expires: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry.data as T;
  }
  return null;
}

function setCached<T>(key: string, data: T, ttlMs = 1000 * 60 * 30) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

export async function getHomeSections() {
  const cached = getCached("home_sections");
  if (cached) return cached;

  const yt = await getYt();
  const sections = await yt.getHomeSections();

  const mapped = sections.map((section: any) => ({
    title: section.title,
    contents: (section.contents ?? []).map((item: any) => {
      if (item.type === "SONG") return mapSong(item);
      if (item.type === "ALBUM") return mapAlbum(item);
      return mapPlaylist(item);
    }).filter(Boolean),
  }));

  setCached("home_sections", mapped);
  return mapped;
}

export async function searchSongs(query: string, limit = 30) {
  const key = `search_${query}`;
  const cached = getCached(key);
  if (cached) return cached;

  const yt = await getYt();
  const results = await yt.searchSongs(query);
  const mapped = results.slice(0, limit).map(mapSong);

  setCached(key, mapped, 1000 * 60 * 10);
  return mapped;
}

export async function searchAll(query: string, limit = 30) {
  const key = `searchall_${query}`;
  const cached = getCached(key);
  if (cached) return cached;

  const yt = await getYt();
  const results = await yt.search(query);
  const mapped = results.slice(0, limit).map((item: any) => {
    if (item.type === "SONG") return mapSong(item);
    if (item.type === "ARTIST") return mapArtist(item);
    if (item.type === "ALBUM") return mapAlbum(item);
    if (item.type === "PLAYLIST") return mapPlaylist(item);
    return null;
  }).filter(Boolean);

  setCached(key, mapped, 1000 * 60 * 10);
  return mapped;
}

export async function getPlaylistVideos(playlistId: string) {
  const key = `playlist_${playlistId}`;
  const cached = getCached(key);
  if (cached) return cached;

  const yt = await getYt();
  try {
    const playlist = await yt.getPlaylistVideos(playlistId);
    const mapped = (playlist ?? []).map(mapSong);
    setCached(key, mapped);
    return mapped;
  } catch (error) {
    console.error("getPlaylistVideos error:", playlistId, error);
    return [];
  }
}

export async function getAlbumSongs(albumId: string) {
  const key = `album_${albumId}`;
  const cached = getCached(key);
  if (cached) return cached;

  const yt = await getYt();
  try {
    const album: any = await yt.getAlbum(albumId);
    if (album?.songs) {
      const songs = album.songs.map(mapSong);
      setCached(key, songs);
      return songs;
    }
  } catch (error) {
    console.error("getAlbumSongs error:", albumId, error);
  }

  try {
    const playlistVideos = (await getPlaylistVideos(albumId)) as any[];
    if (playlistVideos.length > 0) return playlistVideos;
  } catch {}

  return [];
}

export async function getArtistSongs(artistId: string) {
  const key = `artist_songs_${artistId}`;
  const cached = getCached(key);
  if (cached) return cached;

  const yt = await getYt();
  const songs = await yt.getArtistSongs(artistId);
  const mapped = (songs ?? []).slice(0, 30).map(mapSong);

  setCached(key, mapped);
  return mapped;
}

function mapSong(song: any) {
  return {
    type: "song" as const,
    videoId: song.videoId,
    name: song.name,
    artist: song.artist?.name,
    artistId: song.artist?.artistId,
    album: song.album?.name,
    duration: song.duration,
    thumbnail: bestThumb(song.thumbnails),
  };
}

function mapArtist(artist: any) {
  return {
    type: "artist" as const,
    artistId: artist.artistId,
    name: artist.name,
    thumbnail: bestThumb(artist.thumbnails),
  };
}

function mapAlbum(album: any) {
  return {
    type: "album" as const,
    albumId: album.albumId,
    name: album.name,
    artist: album.artist?.name,
    thumbnail: bestThumb(album.thumbnails),
  };
}

function mapPlaylist(playlist: any) {
  return {
    type: "playlist" as const,
    playlistId: playlist.playlistId,
    name: playlist.name,
    artist: playlist.artist?.name,
    thumbnail: bestThumb(playlist.thumbnails),
  };
}

function bestThumb(thumbnails: any[]): string | null {
  if (!thumbnails || thumbnails.length === 0) return null;
  return thumbnails[thumbnails.length - 1]?.url ?? thumbnails[0]?.url ?? null;
}