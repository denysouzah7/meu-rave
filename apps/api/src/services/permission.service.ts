import { and, eq } from "drizzle-orm";
import { db } from "../database/client.js";
import { roomParticipants, rooms, users, type RoomParticipant } from "../database/schema.js";
import { forbidden, notFound } from "../utils/http.js";

export function getParticipant(roomId: string, userId: string) {
  return db
    .select()
    .from(roomParticipants)
    .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)))
    .get();
}

export function assertRoomModerator(roomId: string, userId: string) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (user?.role === "admin") {
    return;
  }

  const room = db.select().from(rooms).where(eq(rooms.id, roomId)).get();
  if (!room) {
    throw notFound("Sala nao encontrada");
  }

  const participant = getParticipant(roomId, userId);
  if (room.creatorId !== userId && !participant?.canModerate) {
    throw forbidden("Voce nao pode moderar esta sala");
  }
}

export function assertCanChat(roomId: string, userId: string) {
  const participant = getParticipant(roomId, userId);
  if (!participant || participant.isBanned || participant.isMuted || !participant.canChat) {
    throw forbidden("Voce nao pode conversar nesta sala");
  }
}

export function assertCanSendAudio(roomId: string, userId: string) {
  const participant = getParticipant(roomId, userId);
  if (!participant || participant.isBanned || participant.isMuted || !participant.canSendAudio) {
    throw forbidden("Voce nao pode enviar audio nesta sala");
  }
}

export function serializeParticipant(participant: RoomParticipant) {
  return {
    ...participant,
    roleLabel:
      participant.role === "administrator"
        ? "Administrador"
        : participant.role === "moderator"
          ? "Moderador"
          : participant.role === "viewer"
            ? "Espectador"
            : "Participante"
  };
}
