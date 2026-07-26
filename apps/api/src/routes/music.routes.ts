import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/authenticate.js";
import {
  getHomeSections,
  searchAll,
  getAlbum,
  getArtistData,
  getYouTubeId,
} from "../services/music.service.js";
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

  app.get("/music/stream/:videoId", async (req, reply) => {
    const { videoId } = req.params as { videoId: string };
    try {
      const result = await (youtubedl as any)(`https://www.youtube.com/watch?v=${videoId}`, {
        format: "bestaudio",
        getUrl: true,
        noWarnings: true,
        noCheckCertificate: true,
        extractorArgs: { youtube: { player_client: ["android"] } },
      }) as string;
      return reply.redirect(result.trim());
    } catch (err) {
      console.error("Stream error:", videoId, err);
      return reply.status(500).send({ error: "Stream failed" });
    }
  });
}