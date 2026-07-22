import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, requireAdmin } from "../middleware/authenticate.js";
import {
  createRoom,
  deleteRoom,
  endRoom,
  getRoomBySlug,
  listParticipants,
  listRooms,
  updateParticipantPermissions,
  updateRoom
} from "../services/room.service.js";
import {
  addContent,
  getPlaybackState,
  listRoomContents,
  removeContent,
  setActiveContent,
  updatePlayback
} from "../services/content.service.js";
import { getMessageRetentionDays } from "../services/settings.service.js";
import {
  countRoomMessages,
  listMessages,
  listPinnedMessages,
  listRoomMessageRanking
} from "../services/message.service.js";

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().url().nullable().optional()
);

const roomSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  type: z.enum(["rave", "group"]).default("rave"),
  description: z.string().trim().min(8).max(500),
  category: z.string().trim().min(2).max(60),
  bannerUrl: optionalUrl,
  coverUrl: optionalUrl,
  backgroundUrl: optionalUrl,
  radioEnabled: z.boolean().optional(),
  radioUrl: optionalUrl,
  isActive: z.boolean().optional()
});

const updateRoomSchema = roomSchema.partial();

const contentSchema = z.object({
  title: z.string().min(2).max(120),
  sourceUrl: z.string().url(),
  uploadId: z.string().nullable().optional(),
  durationSeconds: z.number().nonnegative().nullable().optional()
});

const playbackSchema = z.object({
  contentId: z.string().nullable().optional(),
  isPlaying: z.boolean(),
  positionSeconds: z.number().nonnegative()
});

const participantSchema = z.object({
  role: z.enum(["administrator", "moderator", "participant", "viewer"]).optional(),
  canWatch: z.boolean().optional(),
  canChat: z.boolean().optional(),
  canSendAudio: z.boolean().optional(),
  canModerate: z.boolean().optional(),
  isMuted: z.boolean().optional(),
  isBanned: z.boolean().optional(),
  bannedReason: z.string().max(200).nullable().optional()
});

export async function roomsRoutes(app: FastifyInstance) {
  app.get("/rooms", { preHandler: authenticate }, async (request) => {
    const includeInactive = request.currentUser?.role === "admin";
    return { rooms: listRooms(includeInactive) };
  });

  app.post("/admin/rooms", { preHandler: requireAdmin }, async (request) => {
    const input = roomSchema.parse(request.body);
    return { room: createRoom(input, request.currentUser!.id) };
  });

  app.patch("/admin/rooms/:id", { preHandler: requireAdmin }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = updateRoomSchema.parse(request.body);
    return { room: updateRoom(params.id, input) };
  });

  app.delete("/admin/rooms/:id", { preHandler: requireAdmin }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return deleteRoom(params.id);
  });

  app.get("/rooms/slug/:slug", { preHandler: authenticate }, async (request) => {
    const params = z.object({ slug: z.string() }).parse(request.params);
    const { room, participant } = getRoomBySlug(params.slug, request.currentUser!.id);
    const playback = getPlaybackState(room.id);
    const contents = listRoomContents(room.id);
    const participants = listParticipants(room.id);
    const messages = listMessages(room.id, 80, request.currentUser!.id);
    const pinnedMessages = listPinnedMessages(room.id);
    const messageCount = countRoomMessages(room.id);
    const messageRanking = listRoomMessageRanking(room.id);
    const messageRetentionDays = getMessageRetentionDays();
    return {
      room,
      participant,
      contents,
      playback,
      participants,
      messages,
      pinnedMessages,
      messageCount,
      messageRanking,
      messageRetentionDays
    };
  });

  app.get("/rooms/:id/participants", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return { participants: listParticipants(params.id) };
  });

  app.patch("/rooms/:id/participants/:participantId", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string(), participantId: z.string() }).parse(request.params);
    const input = participantSchema.parse(request.body);
    return {
      participant: updateParticipantPermissions(
        params.id,
        params.participantId,
        request.currentUser!.id,
        input
      )
    };
  });

  app.post("/rooms/:id/end", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return { room: endRoom(params.id, request.currentUser!.id) };
  });

  app.get("/rooms/:id/contents", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const playback = getPlaybackState(params.id);
    return { contents: listRoomContents(params.id), playback };
  });

  app.post("/rooms/:id/contents", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = contentSchema.parse(request.body);
    return addContent(params.id, request.currentUser!.id, input);
  });

  app.delete("/rooms/:id/contents/:contentId", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string(), contentId: z.string() }).parse(request.params);
    return removeContent(params.id, params.contentId, request.currentUser!.id);
  });

  app.post("/rooms/:id/contents/:contentId/activate", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string(), contentId: z.string() }).parse(request.params);
    return { playback: setActiveContent(params.id, params.contentId, request.currentUser!.id) };
  });

  app.patch("/rooms/:id/playback", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = playbackSchema.parse(request.body);
    return { playback: updatePlayback(params.id, request.currentUser!.id, input) };
  });
}
