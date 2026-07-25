import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/authenticate.js";
import {
  getHomeSections,
  searchAll,
  getAlbum,
  getArtistTop,
  getYouTubeId,
} from "../services/music.service.js";

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

  app.get("/music/artist/:id/top", { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const songs = await getArtistTop(id);
    return { songs };
  });

  app.get("/music/youtube-id", { preHandler: [authenticate] }, async (req) => {
    const { name, artist } = req.query as { name?: string; artist?: string };
    if (!name) return { videoId: null };
    const videoId = await getYouTubeId(name, artist ?? "");
    return { videoId };
  });
}