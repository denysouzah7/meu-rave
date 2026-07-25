import { fromNodeHeaders } from "better-auth/node";
import type { IncomingHttpHeaders } from "node:http";
import type { Server, Socket } from "socket.io";
import { auth } from "../auth/auth.js";
import { getUserById, ensureFirstAdmin } from "../services/user.service.js";
import {
  getRoomBySlug,
  joinRoom,
  leaveRoom,
  listParticipants,
  updateParticipantPermissions,
} from "../services/room.service.js";
import {
  getPlaybackState,
  listRoomContents,
  setActiveContent,
  updatePlayback,
} from "../services/content.service.js";
import {
  countRoomMessages,
  createAudioFromUpload,
  createMessage,
  listMessages,
  listPinnedMessages,
  listRoomMessageRanking,
  pinMessage,
  softDeleteMessage,
  toggleMessageLike,
  toggleMessageReaction,
  updateMessage,
  userCanDeleteMessage,
  votePoll,
} from "../services/message.service.js";
import {
  assertCanChat,
  assertCanSendAudio,
  assertRoomModerator,
} from "../services/permission.service.js";
import { getMessageRetentionDays } from "../services/settings.service.js";
import { forbidden } from "../utils/http.js";

type AuthedSocket = Socket & {
  data: {
    userId: string;
    roomId?: string;
  };
};

const channel = (roomId: string) => `room:${roomId}`;

function emitParticipants(io: Server, roomId: string) {
  io.to(channel(roomId)).emit("participants:update", {
    participants: listParticipants(roomId),
  });
}

function socketError(socket: Socket, error: unknown) {
  const message = error instanceof Error ? error.message : "Erro inesperado";
  socket.emit("error:toast", { message });
}

async function authorizeSocket(socket: Socket, next: (error?: Error) => void) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(socket.request.headers as IncomingHttpHeaders),
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
        const { room, participant: existingParticipant } = getRoomBySlug(
          payload.slug,
          socket.data.userId,
        );
        if (!existingParticipant) {
          throw forbidden("Entre na sala para liberar o chat");
        }
        const participant = joinRoom(
          room.id,
          socket.data.userId,
          room.creatorId === socket.data.userId ||
            existingParticipant.canModerate,
        );
        socket.data.roomId = room.id;
        socket.join(channel(room.id));

        const playback = getPlaybackState(room.id);
        socket.emit("room:state", {
          room,
          participant,
          contents: listRoomContents(room.id),
          playback,
          participants: listParticipants(room.id),
          messages: listMessages(room.id, 80, socket.data.userId),
          pinnedMessages: listPinnedMessages(room.id),
          messageCount: countRoomMessages(room.id),
          messageRanking: listRoomMessageRanking(room.id),
          messageRetentionDays: getMessageRetentionDays(),
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

    socket.on("chat:typing", () => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const participants = listParticipants(roomId);
      const found = participants.find((p) => p.userId === socket.data.userId);
      const userName = found?.name ?? "Alguem";
      socket.broadcast.to(channel(roomId)).emit("chat:typing", {
        userId: socket.data.userId,
        userName,
      });
    });

    socket.on(
      "chat:message",
      (payload: {
        type: "text" | "sticker" | "audio" | "image" | "poll";
        body?: string;
        replyToMessageId?: string | null;
        stickerId?: string | null;
        audioUploadId?: string | null;
        audioDurationSeconds?: number;
        imageUploadId?: string | null;
        poll?: {
          question: string;
          options: string[];
          allowsMultiple?: boolean;
        } | null;
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
              payload.audioDurationSeconds ?? 0,
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
            audioId,
            imageUploadId: payload.imageUploadId,
            poll: payload.poll,
          });
          io.to(channel(roomId)).emit("chat:message", {
            message,
            messageCount: countRoomMessages(roomId),
            messageRanking: listRoomMessageRanking(roomId),
          });
        } catch (error) {
          socketError(socket, error);
        }
      },
    );

    socket.on("poll:vote", (payload: { pollId: string; optionId: string }) => {
      try {
        const roomId = socket.data.roomId;
        if (!roomId) {
          throw forbidden("Entre em uma sala primeiro");
        }
        assertCanChat(roomId, socket.data.userId);
        const poll = votePoll(
          roomId,
          payload.pollId,
          payload.optionId,
          socket.data.userId,
        );
        io.to(channel(roomId)).emit("poll:update", { poll });
      } catch (error) {
        socketError(socket, error);
      }
    });

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
        const permission = userCanDeleteMessage(
          payload.messageId,
          socket.data.userId,
        );
        if (!permission.ok) {
          assertRoomModerator(permission.roomId, socket.data.userId);
        }
        const deleted = softDeleteMessage(payload.messageId);
        io.to(channel(deleted.roomId)).emit("chat:delete", {
          messageId: deleted.id,
          messageCount: countRoomMessages(deleted.roomId),
          messageRanking: listRoomMessageRanking(deleted.roomId),
        });
      } catch (error) {
        socketError(socket, error);
      }
    });

    socket.on(
      "chat:pin",
      (payload: { messageId: string; isPinned: boolean }) => {
        try {
          if (!socket.data.roomId) {
            throw forbidden("Entre em uma sala primeiro");
          }
          assertRoomModerator(socket.data.roomId, socket.data.userId);
          const updated = pinMessage(payload.messageId, payload.isPinned);
          io.to(channel(socket.data.roomId)).emit("chat:pin", {
            messageId: updated.id,
            isPinned: updated.isPinned,
          });
        } catch (error) {
          socketError(socket, error);
        }
      },
    );

    socket.on("chat:edit", (payload: { messageId: string; body: string }) => {
      try {
        if (!socket.data.roomId) {
          throw forbidden("Entre em uma sala primeiro");
        }
        const message = updateMessage(
          payload.messageId,
          socket.data.userId,
          payload.body,
        );
        io.to(channel(socket.data.roomId)).emit("chat:edit", { message });
      } catch (error) {
        socketError(socket, error);
      }
    });

    socket.on(
      "chat:react",
      (payload: { messageId: string; emoji: string }) => {
        try {
          if (!socket.data.roomId) {
            throw forbidden("Entre em uma sala primeiro");
          }
          const reactions = toggleMessageReaction(
            payload.messageId,
            socket.data.userId,
            payload.emoji,
          );
          io.to(channel(socket.data.roomId)).emit("chat:react", {
            messageId: payload.messageId,
            reactions,
          });
        } catch (error) {
          socketError(socket, error);
        }
      },
    );

    socket.on(
      "player:update",
      (payload: {
        contentId?: string | null;
        isPlaying: boolean;
        positionSeconds: number;
      }) => {
        try {
          if (!socket.data.roomId) {
            throw forbidden("Entre em uma sala primeiro");
          }
          const playback = updatePlayback(
            socket.data.roomId,
            socket.data.userId,
            payload,
          );
          io.to(channel(socket.data.roomId)).emit("player:update", {
            playback,
          });
        } catch (error) {
          socketError(socket, error);
        }
      },
    );

    socket.on("content:activate", (payload: { contentId: string }) => {
      try {
        if (!socket.data.roomId) {
          throw forbidden("Entre em uma sala primeiro");
        }
        const playback = setActiveContent(
          socket.data.roomId,
          payload.contentId,
          socket.data.userId,
        );
        io.to(channel(socket.data.roomId)).emit("player:update", { playback });
      } catch (error) {
        socketError(socket, error);
      }
    });

    socket.on(
      "participant:update",
      (payload: { participantId: string; patch: Record<string, unknown> }) => {
        try {
          if (!socket.data.roomId) {
            throw forbidden("Entre em uma sala primeiro");
          }
          updateParticipantPermissions(
            socket.data.roomId,
            payload.participantId,
            socket.data.userId,
            payload.patch,
          );
          emitParticipants(io, socket.data.roomId);
        } catch (error) {
          socketError(socket, error);
        }
      },
    );

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
