import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import youtubedl from "youtube-dl-exec";

/* ── Deezer API client ── */
const DZ = "https://api.deezer.com";
const cache = new Map<string, { data: unknown; exp: number }>();
const CACHE_MS = 1000 * 60 * 30;

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const e = cache.get(key);
  if (e && e.exp > Date.now()) return Promise.resolve(e.data as T);
  return fn().then(d => { cache.set(key, { data: d, exp: Date.now() + CACHE_MS }); return d; });
}

async function dz(path: string) {
  const res = await fetch(`${DZ}${path}`);
  return res.json();
}

/* ── Mappers ── */
function song(t: any) { return { type: "song", id: String(t.id), name: t.title || t.title_short, artist: t.artist?.name, duration: t.duration, thumbnail: t.album?.cover_medium ?? t.artist?.picture_medium ?? null, previewUrl: t.preview }; }
function album(a: any) { return { type: "album", id: String(a.id), name: a.title, artist: a.artist?.name, thumbnail: a.cover_medium ?? null }; }
function artist(a: any) { return { type: "artist", id: String(a.id), name: a.name, thumbnail: a.picture_medium ?? null }; }

/* ── Env ── */
const env = z.object({
  PORT: z.coerce.number().default(4100),
  SPIDERX_KEY: z.string().default(""),
  HOST: z.string().default("0.0.0.0"),
}).parse(process.env);

/* ── Server ── */
const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

/* ── Routes ── */
app.get("/health", async () => ({ ok: true }));

app.get("/music/home", async () => {
  return cached("home_v3", async () => {
    const [tracks, albums, genres] = await Promise.all([
      dz("/chart/0/tracks?limit=10"),
      dz("/chart/0/albums?limit=10"),
      dz("/genre"),
    ]);
    const genreSections = await Promise.all(
      (genres.data ?? []).filter((g: any) => g.id !== 0).slice(0, 6).map(async (g: any) => {
        try {
          const r = await dz(`/search/track?q=${encodeURIComponent(g.name)}&limit=10`);
          return { title: g.name, contents: (r.data ?? []).map(song) };
        } catch { return null; }
      })
    );
    return {
      sections: [
        { title: "Top Brasil", contents: (tracks.data ?? []).map(song) },
        { title: "Novos albuns", contents: (albums.data ?? []).map(album) },
        ...genreSections.filter(Boolean),
      ]
    };
  });
});

app.get("/music/search", async (req) => {
  const { q } = req.query as { q?: string };
  if (!q) return { results: [] };
  return cached(`search_${q}`, async () => {
    const [t, al, ar] = await Promise.all([
      dz(`/search/track?q=${encodeURIComponent(q)}&limit=10`),
      dz(`/search/album?q=${encodeURIComponent(q)}&limit=5`),
      dz(`/search/artist?q=${encodeURIComponent(q)}&limit=5`),
    ]);
    return { results: [...(t.data ?? []).map(song), ...(al.data ?? []).map(album), ...(ar.data ?? []).map(artist)] };
  });
});

app.get("/music/album/:id", async (req) => {
  const { id } = req.params as { id: string };
  return cached(`album_${id}`, async () => {
    const a = await dz(`/album/${id}`);
    return { songs: (a.tracks?.data ?? []).map((x: any) => song(x)) };
  });
});

app.get("/music/artist/:id", async (req) => {
  const { id } = req.params as { id: string };
  return cached(`artist_${id}`, async () => {
    const [top, albs] = await Promise.all([dz(`/artist/${id}/top?limit=20`), dz(`/artist/${id}/albums`)]);
    return { songs: (top.data ?? []).map(song), albums: (albs.data ?? []).map(album) };
  });
});

app.get("/music/stream-audio", async (req, reply) => {
  const { name, artist } = req.query as { name?: string; artist?: string };
  if (!name) return reply.status(400).send({ error: "name required" });
  const key = env.SPIDERX_KEY;
  const search = encodeURIComponent(`${name} ${artist || ""}`.trim());

  // Try spiderx first if key is set
  if (key) {
    try {
      const r = await fetch(`https://api.spiderx.com.br/api/downloads/play-audio?search=${search}&api_key=${key}`);
      const d = await r.json() as any;
      if (d?.url) return reply.redirect(d.url);
    } catch {}
  }

  // Fallback to yt-dlp
  try {
    const url = await (youtubedl as any)(`ytsearch:${search}`, {
      format: "bestaudio", getUrl: true, noWarnings: true, noCheckCertificate: true, defaultSearch: "ytsearch",
    }) as string;
    return reply.redirect(url.trim());
  } catch {
    try {
      const url = await (youtubedl as any)(`ytsearch:${search}`, {
        format: "best[ext=mp4]/best", getUrl: true, noWarnings: true, noCheckCertificate: true,
        defaultSearch: "ytsearch", "--extractor-args": "youtube:player_client=android",
      }) as string;
      return reply.redirect(url.trim());
    } catch (e) {
      return reply.status(500).send({ error: "Stream failed" });
    }
  }
});

/* ── Start ── */
await app.listen({ port: env.PORT, host: env.HOST });
console.log(`Music API → http://localhost:${env.PORT}`);
