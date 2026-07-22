import { fromNodeHeaders } from "better-auth/node";
import type { IncomingHttpHeaders } from "node:http";
import type { Server, Socket } from "socket.io";
import { auth } from "../auth/auth.js";
import { getUserById, ensureFirstAdmin } from "../services/user.service.js";
import {
  getRoomBySlug,
  leaveRoom,
  listParticipants,
  updateParticipantPermissions
} from "../services/room.service.js";
import {
  getPlaybackState,
  listRoomContents,
  setActiveContent,
  updatePlayback
} from "../services/content.service.js";
import {
  createAudioFromUpload,
  createMessage,
  listMessages,
  pinMessage,
  softDeleteMessage,
  toggleMessageLike,
  userCanDeleteMessage
} from "../services/message.service.js";
import {
  assertCanChat,
  assertCanSendAudio,
  assertRoomModerator
} from "../services/permission.service.js";
import { forbidden } from "../utils/http.js";

type AuthedSocket = Socket & {
  data: {
    userId: string;
    roomId?: string;
  };
};

const channel = (roomId: string) => `room:${roomId}`;

function emitParticipants(io: Server, roomId: string) {
  io.to(channel(roomId)).emit("participants:update", { participants: listParticipants(roomId) });
}

function socketError(socket: Socket, error: unknown) {
  const message = error instanceof Error ? error.message : "Erro inesperado";
  socket.emit("error:toast", { message });
}

async function authorizeSocket(socket: Socket, next: (error?: Error) => void) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(socket.request.headers as IncomingHttpHeaders)
    });

    if (!session) {
      next(new Error("Autenticacao obrigatoria"));
      return;
    }

    ensureFirstAdmin(session.user.id);
    const user = getUserById(session.user.id);
    if (!user || user.isBlocked) {
      next(new Error(user?.blockedReason ?? "Usuario bloqueado"));
      return;
    }

    socket.data.userId = user.id;
    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error("Falha na autenticacao"));
  }
}

export function registerSocket(io: Server) {
  io.use(authorizeSocket);

  io.on("connection", (socket: AuthedSocket) => {
    socket.on("room:join", (payload: { slug: string }) => {
      try {
        const { room, participant } = getRoomBySlug(payload.slug, socket.data.userId);
        socket.data.roomId = room.id;
        socket.join(channel(room.id));

        const playback = getPlaybackState(room.id);
        socket.emit("room:state", {
          room,
          participant,
          contents: listRoomContents(room.id),
          playback,
          participants: listParticipants(room.id),
          messages: listMessages(room.id)
        });
        emitParticipants(io, room.id);
      } catch (error) {
        socketError(socket, error);
      }
    });

    socket.on("room:leave", () => {
      if (!socket.data.roomId) {
        return;
      }
      const roomId = socket.data.roomId;
      leaveRoom(roomId, socket.data.userId);
      socket.leave(channel(roomId));
      socket.data.roomId = undefined;
      emitParticipants(io, roomId);
    });

    socket.on(
      "chat:message",
      (payload: {
        type: "text" | "sticker" | "audio";
        body?: string;
        replyToMessageId?: string | null;
        stickerId?: string | null;
        audioUploadId?: string | null;
        audioDurationSeconds?: number;
      }) => {
        try {
          const roomId = socket.data.roomId;
          if (!roomId) {
            throw forbidden("Entre em uma sala primeiro");
          }

          assertCanChat(roomId, socket.data.userId);
          let audioId: string | null = null;
          if (payload.type === "audio") {
            assertCanSendAudio(roomId, socket.data.userId);
            if (!payload.audioUploadId) {
              throw forbidden("Audio invalido");
            }
            const audio = createAudioFromUpload(
              payload.audioUploadId,
              socket.data.userId,
              payload.audioDurationSeconds ?? 0
            );
            audioId = audio.id;
          }

          const message = createMessage({
            roomId,
            userId: socket.data.userId,
            type: payload.type,
            body: payload.body,
            replyToMessageId: payload.replyToMessageId,
            stickerId: payload.stickerId,
            audioId
          });
          io.to(channel(roomId)).emit("chat:message", { message });
        } catch (error) {
          socketError(socket, error);
        }
      }
    );

    socket.on("chat:like", (payload: { messageId: string }) => {
      try {
        const result = toggleMessageLike(payload.messageId, socket.data.userId);
        if (socket.data.roomId) {
          io.to(channel(socket.data.roomId)).emit("chat:likes", result);
        }
      } catch (error) {
        socketError(socket, error);
      }
    });

    socket.on("chat:delete", (payload: { messageId: string }) => {
      try {
        const permission = userCanDeleteMessage(payload.messageId, socket.data.userId);
        if (!permission.ok) {
          assertRoomModerator(permission.roomId, socket.data.userId);
        }
        const deleted = softDeleteMessage(payload.messageId);
        io.to(channel(deleted.roomId)).emit("chat:delete", { messageId: deleted.id });
      } catch (error) {
        socketError(socket, error);
      }
    });

    socket.on("chat:pin", (payload: { messageId: string; isPinned: boolean }) => {
      try {
        if (!socket.data.roomId) {
          throw forbidden("Entre em uma sala primeiro");
        }
        assertRoomModerator(socket.data.roomId, socket.data.userId);
        const updated = pinMessage(payload.messageId, payload.isPinned);
        io.to(channel(socket.data.roomId)).emit("chat:pin", {
          messageId: updated.id,
          isPinned: updated.isPinned
        });
      } catch (error) {
        socketError(socket, error);
      }
    });

    socket.on(
      "player:update",
      (payload: { contentId?: string | null; isPlaying: boolean; positionSeconds: number }) => {
        try {
          if (!socket.data.roomId) {
            throw forbidden("Entre em uma sala primeiro");
          }
          const playback = updatePlayback(socket.data.roomId, socket.data.userId, payload);
          io.to(channel(socket.data.roomId)).emit("player:update", { playback });
        } catch (error) {
          socketError(socket, error);
        }
      }
    );

    socket.on("content:activate", (payload: { contentId: string }) => {
      try {
        if (!socket.data.roomId) {
          throw forbidden("Entre em uma sala primeiro");
        }
        const playback = setActiveContent(socket.data.roomId, payload.contentId, socket.data.userId);
        io.to(channel(socket.data.roomId)).emit("player:update", { playback });
      } catch (error) {
        socketError(socket, error);
      }
    });

    socket.on("participant:update", (payload: { participantId: string; patch: Record<string, unknown> }) => {
      try {
        if (!socket.data.roomId) {
          throw forbidden("Entre em uma sala primeiro");
        }
        updateParticipantPermissions(
          socket.data.roomId,
          payload.participantId,
          socket.data.userId,
          payload.patch
        );
        emitParticipants(io, socket.data.roomId);
      } catch (error) {
        socketError(socket, error);
      }
    });

    socket.on("disconnect", () => {
      if (!socket.data.roomId) {
        return;
      }
      const roomId = socket.data.roomId;
      leaveRoom(roomId, socket.data.userId);
      emitParticipants(io, roomId);
    });
  });
}
