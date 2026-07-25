import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/authenticate.js";
import {
  getHomeSections,
  searchSongs,
  searchAll,
  getPlaylistVideos,
  getArtistSongs,
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

  app.get("/music/search-songs", { preHandler: [authenticate] }, async (req) => {
    const { q } = req.query as { q?: string };
    if (!q) return { songs: [] };
    const songs = await searchSongs(q);
    return { songs };
  });

  app.get("/music/playlist/:id", { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const songs = await getPlaylistVideos(id);
    return { songs };
  });

  app.get("/music/artist/:id/songs", { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const songs = await getArtistSongs(id);
    return { songs };
  });
}