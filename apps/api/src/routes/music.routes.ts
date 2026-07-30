import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/authenticate.js";
import {
  getHomeSections,
  searchAll,
  getAlbum,
  getArtistData,
  getYouTubeId,
} from "../services/music.service.js";
import { getSpiderxApiKey } from "../services/settings.service.js";
import youtubedl from "youtube-dl-exec";

export async function musicRoutes(app: FastifyInstance) {
  app.get("/music/home", { preHandler: [authenticate] }, async () => {
    const sections = await getHomeSections();
    return { sections };
  });

  app.get("/music/search", { preHandler: [authenticate] }, async (req) => {
    const { q } = req.query as { q?: string };
    if (!q) return { results: [] };
    const results = await searchAll(q);
    return { results };
  });

  app.get("/music/album/:id", { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const songs = await getAlbum(id);
    return { songs };
  });

  app.get("/music/artist/:id", { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const data = await getArtistData(id);
    return data;
  });

  app.get("/music/youtube-id", { preHandler: [authenticate] }, async (req) => {
    const { name, artist } = req.query as { name?: string; artist?: string };
    if (!name) return { videoId: null };
    const videoId = await getYouTubeId(name, artist ?? "");
    return { videoId };
  });

  app.get("/music/stream-audio", async (req, reply) => {
    const { name, artist } = req.query as { name?: string; artist?: string };
    if (!name) return reply.status(400).send({ error: "name is required" });
    const search = encodeURIComponent(`${name} ${artist || ""}`.trim());
    const key = getSpiderxApiKey();

    if (key) {
      try {
        const res = await fetch(`https://api.spiderx.com.br/api/downloads/play-audio?search=${search}&api_key=${key}`);
        const data = await res.json() as any;
        if (data?.url) return reply.redirect(data.url);
      } catch {}
    }

    try {
      const url = await (youtubedl as any)(`ytsearch:${search}`, {
        format: "bestaudio", getUrl: true, noWarnings: true, noCheckCertificate: true,
      }) as string;
      return reply.redirect(url.trim());
    } catch {
      try {
        const url = await (youtubedl as any)(`ytsearch:${search}`, {
          format: "best[ext=mp4]/best", getUrl: true, noWarnings: true, noCheckCertificate: true,
          "--extractor-args": "youtube:player_client=android",
        }) as string;
        return reply.redirect(url.trim());
      } catch (e) {
        console.error("Stream error:", e);
        return reply.status(500).send({ error: "Stream failed" });
      }
    }
  });

  app.get("/music/stream/:videoId", async (req, reply) => {
    const { videoId } = req.params as { videoId: string };
    try {
      // Try normal first (works on non-blocked IPs)
      try {
        const result = await (youtubedl as any)(`https://www.youtube.com/watch?v=${videoId}`, {
          format: "bestaudio",
          getUrl: true,
          noWarnings: true,
          noCheckCertificate: true,
        }) as string;
        return reply.redirect(result.trim());
      } catch {
        // Fallback to Android client for blocked VPS IPs
        const result = await (youtubedl as any)(`https://www.youtube.com/watch?v=${videoId}`, {
          format: "best[ext=mp4]/best",
          getUrl: true,
          noWarnings: true,
          noCheckCertificate: true,
          "--extractor-args": "youtube:player_client=android",
        }) as string;
        return reply.redirect(result.trim());
      }
    } catch (err) {
      console.error("Stream error:", videoId, err);
      return reply.status(500).send({ error: "Stream failed" });
    }
  });
}