import * as React from "react";
import {
  BarChart3,
  Check,
  EllipsisVertical,
  Copy,
  Heart,
  ImagePlus,
  Info,
  Loader2,
  Mic,
  Paperclip,
  Pause,
  Pin,
  Pencil,
  Play,
  Plus,
  Reply,
  Send,
  StickerIcon,
  Trash2,
  X,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ChatMessage,
  MessageReaction,
  Participant,
  Sticker,
  StickerPack,
} from "@/services/types";
import { api, resolveMediaUrl, uploadFile } from "@/services/api";
import { useStickerPacks } from "@/hooks/useApi";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDuration } from "@/lib/utils";
import { createMediaBackgroundStyle } from "@/lib/media";

const MAX_AUDIO_DURATION_SECONDS = 120;
const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];
const AUTHOR_COLORS = [
  "#f59e0b",
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#fb7185",
  "#f472b6",
  "#60a5fa",
];

function getSupportedAudioMimeType() {
  if (
    typeof MediaRecorder === "undefined" ||
    typeof MediaRecorder.isTypeSupported !== "function"
  ) {
    return "";
  }

  return (
    AUDIO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ??
    ""
  );
}

function audioExtensionFromMimeType(mimeType: string) {
  if (mimeType.includes("ogg")) return ".ogg";
  if (mimeType.includes("mp4")) return ".mp4";
  if (mimeType.includes("mpeg")) return ".mp3";
  if (mimeType.includes("wav")) return ".wav";
  return ".webm";
}

function audioRecorderErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Permita o microfone no navegador. No Android, a gravacao exige HTTPS quando acessa pelo IP.";
    }
    if (error.name === "NotFoundError") {
      return "Nenhum microfone foi encontrado neste dispositivo.";
    }
  }

  return "Nao foi possivel iniciar a gravacao de audio neste dispositivo.";
}

type Props = {
  roomName: string;
  onlineCount: number;
  backgroundUrl?: string | null | undefined;
  messages: ChatMessage[];
  currentUserId: string;
  participant: Participant | null;
  canModerate: boolean;
  className?: string;
  onOpenRoomInfo: () => void;
  onSend: (payload: {
    type: "text" | "sticker" | "audio" | "image" | "poll";
    body?: string | undefined;
    replyToMessageId?: string | null | undefined;
    stickerId?: string | null | undefined;
    audioUploadId?: string | null | undefined;
    audioDurationSeconds?: number | undefined;
    imageUploadId?: string | null | undefined;
    poll?:
      | {
          question: string;
          options: string[];
          allowsMultiple?: boolean | undefined;
        }
      | null
      | undefined;
  }) => void;
  onPollVote: (pollId: string, optionId: string) => void;
  onLike: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onPin: (messageId: string, isPinned: boolean) => void;
  onUserClick?: (userId: string) => void;
  onEdit: (messageId: string, body: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  typingUsers?: string[];
  onTyping?: () => void;
};

export function ChatPanel({
  roomName,
  onlineCount,
  backgroundUrl,
  messages,
  currentUserId,
  participant,
  canModerate,
  className,
  onOpenRoomInfo,
  onSend,
  onPollVote,
  onLike,
  onDelete,
  onPin,
  onUserClick,
  onEdit,
  onReact,
  typingUsers,
  onTyping,
}: Props) {
  const [body, setBody] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);
  const [selectedMessageId, setSelectedMessageId] = React.useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editBody, setEditBody] = React.useState("");
  const [showStickers, setShowStickers] = React.useState(false);
  const [showAttachments, setShowAttachments] = React.useState(false);
  const [showPollComposer, setShowPollComposer] = React.useState(false);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [composerError, setComposerError] = React.useState("");
  const [selectedStickerMessage, setSelectedStickerMessage] =
    React.useState<ChatMessage | null>(null);
  const messagesViewportRef = React.useRef<HTMLDivElement | null>(null);
  const messageBoxRef = React.useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = React.useRef<HTMLInputElement | null>(null);
  const touchSendHandledRef = React.useRef(false);
  const lastTypingEmitRef = React.useRef(0);
  const messageById = React.useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );
  const queryClient = useQueryClient();
  const stickerPacksQuery = useStickerPacks();
  const allPacks = stickerPacksQuery.data?.packs ?? [];
  const ownedStickerIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const pack of allPacks) {
      for (const sticker of pack.stickers) {
        ids.add(sticker.id);
        if (sticker.sourceStickerId) ids.add(sticker.sourceStickerId);
      }
    }
    return ids;
  }, [allPacks]);
  const isStickerAlreadySaved = React.useCallback(
    (stickerId: string | null | undefined) =>
      Boolean(stickerId && ownedStickerIds.has(stickerId)),
    [ownedStickerIds],
  );
  const saveSticker = useMutation({
    mutationFn: (stickerId: string) =>
      api<{ sticker: Sticker }>(`/stickers/${stickerId}/save`, {
        method: "POST",
      }),
    onSuccess: async () => {
      setComposerError("");
      await queryClient.invalidateQueries({ queryKey: ["stickers", "packs"] });
    },
    onError: (error) => {
      setComposerError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar a figurinha.",
      );
    },
  });

  const scrollMessagesToBottom = React.useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const viewport = messagesViewportRef.current;
      if (!viewport) return;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    },
    [],
  );

  React.useEffect(() => {
    scrollMessagesToBottom("smooth");
  }, [messages.length, scrollMessagesToBottom]);

  React.useEffect(() => {
    const messageBox = messageBoxRef.current;
    if (!messageBox) return;
    messageBox.style.height = "0px";
    messageBox.style.height = `${Math.min(messageBox.scrollHeight, 96)}px`;
  }, [body]);

  React.useEffect(() => {
    const closeActions = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-action-bar]")) return;
      setSelectedMessageId(null);
    };
    document.addEventListener("pointerdown", closeActions);
    return () => document.removeEventListener("pointerdown", closeActions);
  }, []);

  const canChat = Boolean(
    participant?.canChat && !participant.isMuted && !participant.isBanned,
  );

  const submit = React.useCallback(() => {
    if (editingMessageId) {
      if (!editBody.trim()) return;
      onEdit(editingMessageId, editBody.trim());
      setEditingMessageId(null);
      setEditBody("");
      setBody("");
      setReplyTo(null);
      return;
    }
    if (!body.trim() || !canChat) return;
    onSend({
      type: "text",
      body: body.trim(),
      replyToMessageId: replyTo?.id,
    });
    setBody("");
    setReplyTo(null);
    setShowAttachments(false);
    window.requestAnimationFrame(() => {
      messageBoxRef.current?.focus({ preventScroll: true });
    });
  }, [body, canChat, onSend, replyTo?.id, editingMessageId, editBody, onEdit]);

  const sendImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canChat) return;

    setComposerError("");
    setUploadingImage(true);
    setShowStickers(false);
    setShowAttachments(false);
    setShowPollComposer(false);

    try {
      const result = await uploadFile("image", file);
      onSend({
        type: "image",
        imageUploadId: result.upload.id,
        body: body.trim() || undefined,
        replyToMessageId: replyTo?.id,
      });
      setBody("");
      setReplyTo(null);
    } catch (error) {
      setComposerError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel enviar a imagem.",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const messageBackgroundStyle = React.useMemo(
    () => createMediaBackgroundStyle(backgroundUrl, 0.74),
    [backgroundUrl],
  );

  return (
    <Card
      className={cn(
        "room-chat-panel room-panel-texture flex h-[min(760px,calc(100vh-96px))] min-h-[360px] flex-col overflow-hidden border-white/10 shadow-2xl max-sm:h-[min(520px,56svh)] max-sm:min-h-[320px] lg:h-auto lg:min-h-0 lg:flex-1",
        className,
      )}
    >
      <div className="room-chat-header flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-[#111b21] px-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition hover:bg-white/[0.04]"
          onClick={onOpenRoomInfo}
        >
          <span className="relative shrink-0">
            <Avatar
              name={roomName}
              className="h-11 w-11 rounded-full border-primary/30 bg-primary/[0.16]"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#111b21] bg-emerald-400" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">
              {roomName}
            </span>
            <span className="block truncate text-xs text-[#aebac1]">
              {onlineCount} online
            </span>
          </span>
        </button>
        <Badge
          variant={canChat ? "default" : "destructive"}
          className="rounded-full"
        >
          {canChat ? "chat" : "restrito"}
        </Badge>
      </div>

      <CardContent className="room-chat-body flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {typingUsers && typingUsers.length > 0 && (
          <div className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.04] px-4 py-2">
            <div className="flex items-center gap-[2px]">
              <span className="typing-bar" />
              <span className="typing-bar" />
              <span className="typing-bar" />
              <span className="typing-bar" />
            </div>
            <p className="truncate text-[13px] font-medium text-[#aebac1]">
              {typingUsers.length === 1
                ? typingUsers[0]
                : typingUsers.length === 2
                  ? `${typingUsers[0]} e ${typingUsers[1]}`
                  : `${typingUsers[0]} e mais ${typingUsers.length - 1}`}
            </p>
          </div>
        )}
        {selectedMessageId && (() => {
          const msg = messageById.get(selectedMessageId);
          if (!msg) return null;
          const isOwn = msg.userId === currentUserId;
          const canEdit = isOwn && msg.type === "text" && Date.now() - new Date(msg.createdAt).getTime() < 7 * 60 * 1000;
          const ownCanDelete = isOwn;
          return (
            <div data-action-bar className="flex shrink-0 items-center justify-between border-b border-white/[0.04] bg-[#182229] px-4 py-2">
              {isOwn ? (
                <div className="flex items-center gap-3">
                  {canEdit && (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-[13px] font-medium text-[#aebac1] transition hover:text-white"
                      onClick={() => {
                        setEditBody(msg.body ?? "");
                        setEditingMessageId(msg.id);
                        setSelectedMessageId(null);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </button>
                  )}
                  {ownCanDelete && (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-[13px] font-medium text-red-400 transition hover:text-red-300"
                      onClick={() => {
                        onDelete(msg.id);
                        setSelectedMessageId(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Apagar
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => {
                    const hasReacted = msg.reactions?.some(
                      (r) => r.emoji === emoji && r.userId === currentUserId,
                    );
                    return (
                      <button
                        key={emoji}
                        type="button"
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full text-lg transition",
                          hasReacted
                            ? "bg-white/[0.12]"
                            : "hover:bg-white/[0.06]",
                        )}
                        onClick={() => {
                          onReact(msg.id, emoji);
                          setSelectedMessageId(null);
                        }}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                aria-label="Fechar"
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#8696a0] transition hover:bg-white/[0.06] hover:text-white"
                onClick={() => setSelectedMessageId(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })()}
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          canModerate={canModerate}
          messageById={messageById}
          messageBackgroundStyle={messageBackgroundStyle}
          messagesViewportRef={messagesViewportRef}
          selectedMessageId={selectedMessageId}
          ownedStickerIds={ownedStickerIds}
          onSelectMessage={(id) =>
            setSelectedMessageId((current) =>
              current === id ? null : id,
            )
          }
          onReply={(message) => {
            setReplyTo(message);
            setSelectedMessageId(null);
            const focusBox = () => {
              const box = messageBoxRef.current;
              if (!box) return;
              box.focus({ preventScroll: true });
              const len = box.value.length;
              box.setSelectionRange(len, len);
            };
            window.requestAnimationFrame(() =>
              window.setTimeout(focusBox, 50),
            );
          }}
          onCopy={(text) => {
            if (text) {
              void navigator.clipboard.writeText(text);
            }
            setSelectedMessageId(null);
          }}
          onLike={(messageId) => {
            onLike(messageId);
            setSelectedMessageId(null);
          }}
          onDelete={(messageId) => {
            onDelete(messageId);
            setSelectedMessageId(null);
          }}
          onPin={(messageId, isPinned) => {
            onPin(messageId, isPinned);
            setSelectedMessageId(null);
          }}
          onSaveSticker={(stickerId) => {
            saveSticker.mutate(stickerId);
            setSelectedMessageId(null);
          }}
          onOpenStickerDetails={(message) =>
            setSelectedStickerMessage(message)
          }
          onPollVote={onPollVote}
          onUserClick={onUserClick}
        />

        {editingMessageId && (() => {
          const editingMessage = messageById.get(editingMessageId);
          if (!editingMessage) return null;
          return (
            <div className="flex items-center gap-2 border-t border-white/[0.06] bg-[#182229] px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-primary">Editar mensagem</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#8696a0] transition hover:bg-white/[0.06] hover:text-white"
                  onClick={() => setEditingMessageId(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })()}

        <div className="room-chat-composer sticky bottom-0 z-30 shrink-0 bg-[#0b141a]/98 shadow-[0_-10px_22px_rgba(0,0,0,0.20)] backdrop-blur max-sm:static">
          {replyTo && (
            <div className="px-2.5 pt-2">
              <div className="flex items-center gap-2 rounded-xl border-l-4 border-primary bg-[#202c33] px-3 py-2 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-primary">
                    {replyTo.authorName ?? "Mensagem"}
                  </p>
                  <p className="truncate text-xs text-[#aebac1]">
                    {replyPreview(replyTo)}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Cancelar resposta"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setReplyTo(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {showStickers && (
            <StickerTray
              onClose={() => setShowStickers(false)}
              onPick={(sticker) => {
                onSend({
                  type: "sticker",
                  stickerId: sticker.id,
                  replyToMessageId: replyTo?.id,
                });
                setReplyTo(null);
                setShowStickers(false);
                setShowAttachments(false);
              }}
            />
          )}

          {showPollComposer && (
            <PollComposer
              onClose={() => setShowPollComposer(false)}
              onSubmit={(poll) => {
                onSend({ type: "poll", poll, replyToMessageId: replyTo?.id });
                setReplyTo(null);
                setShowAttachments(false);
                setShowPollComposer(false);
              }}
            />
          )}

          {composerError && (
            <div className="px-3 pt-2">
              <p className="rounded-lg border border-red-400/[0.20] bg-red-500/[0.10] px-3 py-2 text-xs text-red-100">
                {composerError}
              </p>
            </div>
          )}

          <div className="p-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={sendImage}
            />
            <div className="flex items-end gap-1.5">
              <div className="flex min-w-0 flex-1 items-end rounded-[26px] bg-[#202c33] px-1.5 py-1 shadow-sm">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Figurinhas"
                  className="h-9 w-9 shrink-0 rounded-full text-[#aebac1] hover:bg-white/[0.06] hover:text-white"
                  onClick={() => {
                    setComposerError("");
                    setShowAttachments(false);
                    setShowPollComposer(false);
                    setShowStickers((value) => !value);
                  }}
                >
                  <StickerIcon className="h-5 w-5" />
                </Button>
                <Textarea
                  ref={messageBoxRef}
                  rows={1}
                  value={editingMessageId ? editBody : body}
                  onChange={(event) => {
                    if (editingMessageId) {
                      setEditBody(event.target.value);
                    } else {
                      setBody(event.target.value);
                    }
                    const now = Date.now();
                    if (now - lastTypingEmitRef.current > 2000) {
                      lastTypingEmitRef.current = now;
                      onTyping?.();
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  disabled={!canChat}
                  placeholder={editingMessageId ? "Editar mensagem" : canChat ? "Mensagem" : "Chat restrito"}
                  autoComplete="off"
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  spellCheck={true}
                  inputMode="text"
                  enterKeyHint="send"
                  aria-label="Mensagem"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  className="max-h-24 min-h-10 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2.5 text-[15px] leading-5 text-[#e9edef] placeholder:text-[#8696a0] focus:ring-0"
                />
                <div className="relative shrink-0">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Anexos"
                    aria-expanded={showAttachments}
                    disabled={!canChat || uploadingImage}
                    className={cn(
                      "h-9 w-9 rounded-full text-[#aebac1] hover:bg-white/[0.06] hover:text-white",
                      (showAttachments || showPollComposer) &&
                        "bg-white/[0.08] text-white",
                    )}
                    onClick={() => {
                      setComposerError("");
                      setShowStickers(false);
                      if (!showAttachments) {
                        setShowPollComposer(false);
                      }
                      setShowAttachments((value) => !value);
                    }}
                  >
                    {uploadingImage ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Paperclip className="h-5 w-5" />
                    )}
                  </Button>

                  {showAttachments && (
                    <div className="absolute bottom-[calc(100%+0.625rem)] right-0 z-50 w-52 rounded-2xl border border-white/10 bg-[#182229] p-2 shadow-2xl">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-white/[0.06]"
                        onClick={() => {
                          setShowAttachments(false);
                          setShowPollComposer(false);
                          imageInputRef.current?.click();
                        }}
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#b91c7d] text-white">
                          <ImagePlus className="h-4 w-4" />
                        </span>
                        Foto
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-white/[0.06]"
                        onClick={() => {
                          setComposerError("");
                          setShowStickers(false);
                          setShowAttachments(false);
                          setShowPollComposer((value) => !value);
                        }}
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0f766e] text-white">
                          <BarChart3 className="h-4 w-4" />
                        </span>
                        Enquete
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {body.trim() || editingMessageId ? (
                <Button
                  type="button"
                  size="icon"
                  aria-label={editingMessageId ? "Confirmar edicao" : "Enviar"}
                  disabled={!canChat}
                  className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  onPointerDown={(event) => {
                    if (event.pointerType !== "mouse") {
                      event.preventDefault();
                      touchSendHandledRef.current = true;
                      submit();
                    }
                  }}
                  onClick={() => {
                    if (touchSendHandledRef.current) {
                      touchSendHandledRef.current = false;
                      return;
                    }
                    submit();
                  }}
                >
                  {editingMessageId ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              ) : (
                <AudioRecorder
                  disabled={!participant?.canSendAudio || !canChat}
                  onError={(message) => setComposerError(message)}
                  onRecorded={async (file, duration) => {
                    setComposerError("");
                    try {
                      const result = await uploadFile("audio", file);
                      onSend({
                        type: "audio",
                        audioUploadId: result.upload.id,
                        audioDurationSeconds: duration,
                      });
                    } catch (error) {
                      setComposerError(
                        error instanceof Error
                          ? error.message
                          : "Nao foi possivel enviar o audio.",
                      );
                      throw error;
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </CardContent>

      {selectedStickerMessage && (
        <StickerDetailsDialog
          message={selectedStickerMessage}
          isSaving={saveSticker.isPending}
          alreadySaved={isStickerAlreadySaved(selectedStickerMessage.stickerId)}
          onClose={() => setSelectedStickerMessage(null)}
          onSave={() => {
            if (!selectedStickerMessage.stickerId) return;
            saveSticker.mutate(selectedStickerMessage.stickerId);
            setSelectedStickerMessage(null);
          }}
        />
      )}
    </Card>
  );
}

type MessageListProps = {
  messages: ChatMessage[];
  currentUserId: string;
  canModerate: boolean;
  messageById: Map<string, ChatMessage>;
  messageBackgroundStyle: React.CSSProperties | undefined;
  messagesViewportRef: React.MutableRefObject<HTMLDivElement | null>;
  selectedMessageId: string | null;
  ownedStickerIds: Set<string>;
  onSelectMessage: (id: string) => void;
  onReply: (message: ChatMessage) => void;
  onCopy: (text: string | null | undefined) => void;
  onLike: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onPin: (messageId: string, isPinned: boolean) => void;
  onSaveSticker: (stickerId: string) => void;
  onOpenStickerDetails: (message: ChatMessage) => void;
  onPollVote: (pollId: string, optionId: string) => void;
  onUserClick?: ((userId: string) => void) | undefined;
};

const MessageList = React.memo(function MessageList({
  messages,
  currentUserId,
  canModerate,
  messageById,
  messageBackgroundStyle,
  messagesViewportRef,
  selectedMessageId,
  ownedStickerIds,
  onSelectMessage,
  onReply,
  onCopy,
  onLike,
  onDelete,
  onPin,
  onSaveSticker,
  onOpenStickerDetails,
  onPollVote,
  onUserClick,
}: MessageListProps) {
  let previousDay = "";

  return (
    <div
      ref={messagesViewportRef}
      className="room-chat-messages thin-scrollbar min-h-0 flex-1 overscroll-contain overflow-y-auto scroll-pb-4 p-3 pb-4"
      style={messageBackgroundStyle}
    >
      <div>
        {messages.map((message, index) => {
          const day = dayKey(message.createdAt);
          const showDay = day !== previousDay;
          const previousMessage = messages[index - 1];
          const grouped =
            !showDay &&
            message.type !== "system" &&
            Boolean(previousMessage) &&
            previousMessage?.type !== "system" &&
            previousMessage?.userId === message.userId &&
            previousMessage?.type === message.type &&
            Math.abs(
              new Date(message.createdAt).getTime() -
                new Date(previousMessage?.createdAt ?? 0).getTime(),
            ) <
              5 * 60 * 1000;
          previousDay = day;

          return (
            <React.Fragment key={message.id}>
              {showDay && <DayDivider value={message.createdAt} />}
              <MessageBubble
                message={message}
                replyToMessage={
                  message.replyToMessageId
                    ? (messageById.get(message.replyToMessageId) ?? null)
                    : null
                }
                own={message.userId === currentUserId}
                grouped={grouped}
                canModerate={canModerate}
                onSelect={() => onSelectMessage(message.id)}
                onReply={() => onReply(message)}
                onCopy={() => onCopy(message.body)}
                onLike={() => onLike(message.id)}
                onDelete={() => onDelete(message.id)}
                onPin={() => onPin(message.id, !message.isPinned)}
                onSaveSticker={onSaveSticker}
                ownedStickerIds={ownedStickerIds}
                onOpenStickerDetails={() => onOpenStickerDetails(message)}
                onPollVote={onPollVote}
                onUserClick={onUserClick}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
});

const MessageBubble = React.memo(function MessageBubble({
  message,
  replyToMessage,
  own,
  grouped,
  canModerate,
  onSelect,
  onReply,
  onCopy,
  onLike,
  onDelete,
  onPin,
  onSaveSticker,
  onOpenStickerDetails,
  onPollVote,
  onUserClick,
  ownedStickerIds,
}: {
  message: ChatMessage;
  replyToMessage: ChatMessage | null;
  own: boolean;
  grouped: boolean;
  canModerate: boolean;
  onSelect: () => void;
  onReply: () => void;
  onCopy: () => void;
  onLike: () => void;
  onDelete: () => void;
  onPin: () => void;
  onSaveSticker: (stickerId: string) => void;
  onOpenStickerDetails: () => void;
  onPollVote: (pollId: string, optionId: string) => void;
  onUserClick?: ((userId: string) => void) | undefined;
  ownedStickerIds: Set<string>;
}) {
  const [dragX, setDragX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const pointerStart = React.useRef<{
    x: number;
    y: number;
    id: number;
  } | null>(null);
  const canDelete = own || canModerate;
  const canCopy = Boolean(message.body);
  const canSaveSticker =
    message.type === "sticker" &&
    Boolean(message.stickerId) &&
    !ownedStickerIds.has(message.stickerId!);
  const dragDirection = own ? -1 : 1;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isInteractiveTarget(event.target)) return;
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current || pointerStart.current.id !== event.pointerId)
      return;

    const deltaX = (event.clientX - pointerStart.current.x) * dragDirection;
    const deltaY = Math.abs(event.clientY - pointerStart.current.y);

    if (deltaY > 28 && deltaX < 14) {
      pointerStart.current = null;
      return;
    }

    const next = Math.max(0, Math.min(72, deltaX));
    if (next > 6 && !isDragging) {
      setIsDragging(true);
    }
    if (isDragging) {
      setDragX(next * dragDirection);
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const shouldReply = Math.abs(dragX) >= 46;
    pointerStart.current = null;
    setIsDragging(false);
    setDragX(0);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    if (shouldReply) onReply();
  };

  if (message.type === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="max-w-[82%] rounded-full bg-[#182229]/90 px-3 py-1 text-center text-[11px] font-medium text-[#aebac1]">
          {message.body}
        </span>
      </div>
    );
  }

  const isSticker = message.type === "sticker";

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2",
        grouped ? "pt-0.5" : "pt-2",
        own ? "justify-end pr-2 sm:pr-3" : "justify-start",
      )}
    >
      {isDragging && (
        <div
          className={cn(
            "absolute top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-primary/90 text-white shadow-lg transition",
            own ? "right-3" : "left-10",
          )}
        >
          <Reply className="h-4 w-4" />
        </div>
      )}

      {!own &&
        (grouped ? (
          <span className="h-7 w-7 shrink-0" aria-hidden="true" />
        ) : (
          <button
            type="button"
            className="mt-0.5 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
            aria-label={`Ver perfil de ${message.authorName ?? "participante"}`}
            disabled={!onUserClick || !message.userId}
            onClick={(event) => {
              event.stopPropagation();
              if (message.userId) onUserClick?.(message.userId);
            }}
          >
            <Avatar
              src={resolveMediaUrl(message.authorImage)}
              name={message.authorName}
              className="h-7 w-7 rounded-full"
            />
          </button>
        ))}

      <div
        className={cn(
          "min-w-0 max-w-[min(82%,440px)] touch-pan-y",
          own ? "ml-9" : "mr-9",
        )}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : "transform 160ms ease",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          className={cn(
            "relative min-w-0 flow-root",
            isSticker
              ? "bg-transparent p-0 shadow-none ring-0"
              : [
                  "rounded-[7.5px] shadow-[0_1px_1px_rgba(0,0,0,0.18)]",
                  message.type === "image" && "p-1",
                  message.type === "audio" && "px-2 py-1",
                  message.type === "poll" && "px-2 py-1.5",
                  !["audio", "image", "poll"].includes(message.type) &&
                    "px-2.5 py-1.5",
                  own
                    ? "bg-[#005c4b] text-white"
                    : "bg-[#202c33] text-[#e9edef]",
                ],
          )}
        >
          {!own && !grouped && (
            <p className="mb-2 truncate pr-5 text-[13px] font-semibold leading-[17px] text-primary">
              {message.authorName ?? "Participante"}
            </p>
          )}

          {message.isPinned && (
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] text-amber-100">
              <Pin className="h-3 w-3" />
              Fixada
            </div>
          )}

          {replyToMessage && (
            <ReplySnippet message={replyToMessage} own={own} />
          )}

          {message.type === "text" && (
            <div className="break-words text-[15px] leading-[20px]">
              <span className="whitespace-pre-wrap">{message.body}</span>
              <MessageMeta message={message} own={own} inline />
            </div>
          )}
          {message.type === "sticker" && message.stickerUrl && (
            <div className="inline-block rounded-xl bg-transparent p-0">
              <button
                type="button"
                aria-label="Ver detalhes da figurinha"
                className="block rounded-xl bg-transparent p-0 transition active:scale-[0.98]"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenStickerDetails();
                }}
              >
                <img
                  src={resolveMediaUrl(message.stickerUrl)}
                  alt={message.stickerName ?? "Figurinha"}
                  className="max-h-32 max-w-[140px] rounded-lg object-contain"
                />
              </button>
              <MessageMeta message={message} own={own} sticker />
            </div>
          )}
          {message.type === "audio" && message.audioUrl && (
            <AudioMessage
              src={resolveMediaUrl(message.audioUrl)}
              duration={message.audioDuration ?? 0}
              own={own}
            />
          )}
          {message.type === "image" && message.imageUrl && (
            <div className="min-w-[160px] max-w-[260px] sm:max-w-[290px]">
              <div className="overflow-hidden rounded-xl bg-black/20">
                <img
                  src={resolveMediaUrl(message.imageUrl)}
                  alt={message.imageName ?? "Imagem enviada"}
                  loading="lazy"
                  className="max-h-60 w-full object-contain sm:max-h-64"
                />
              </div>
              {message.body && (
                <p className="mt-2 whitespace-pre-wrap break-words px-1 text-[15px] leading-[20px]">
                  {message.body}
                </p>
              )}
            </div>
          )}
          {message.type === "poll" && message.poll && (
            <PollMessage poll={message.poll} own={own} onVote={onPollVote} />
          )}

          {message.type !== "text" && message.type !== "sticker" && (
            <MessageMeta message={message} own={own} sticker={isSticker} />
          )}

          <button
            type="button"
            aria-label="Opcoes da mensagem"
            className={cn(
              "absolute top-1 grid h-7 w-7 place-items-center rounded-full bg-black/15 text-[#d1d7db] opacity-0 transition hover:bg-black/25",
              own ? "left-1" : "right-1",
              "group-hover:opacity-100 group-focus-within:opacity-100",
            )}
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
          >
            <EllipsisVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

function MessageMeta({
  message,
  own,
  inline = false,
  sticker = false,
}: {
  message: ChatMessage;
  own: boolean;
  inline?: boolean;
  sticker?: boolean;
}) {
  return (
    <span
      className={cn(
        "items-center gap-1 whitespace-nowrap text-[10.5px] leading-none",
        inline ? "ml-2 inline-flex translate-y-px" : "float-right ml-3 mt-1 flex h-[14px]",
        sticker && "rounded bg-black/55 px-1.5 py-1 text-white shadow-sm",
        own ? "text-[#d7f7ee]" : "text-[#aebac1]",
      )}
    >
      {Boolean(message.likes) && (
        <span className="inline-flex items-center gap-0.5">
          <Heart className="h-2.5 w-2.5 fill-current" />
          {message.likes}
        </span>
      )}
      {message.editedAt && (
        <span className="text-[9px]">editado</span>
      )}
      <span>{timeLabel(message.createdAt)}</span>
    </span>
  );
}

function ReplySnippet({
  message,
  own,
}: {
  message: ChatMessage;
  own: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-1.5 min-w-0 rounded-lg border-l-4 px-2.5 py-1.5",
        own ? "border-[#8fe7cf] bg-black/20" : "border-primary bg-black/15",
      )}
    >
      <p
        className={cn(
          "truncate text-[11px] font-bold",
          own ? "text-[#baf7e9]" : "text-primary",
        )}
      >
        {message.authorName ?? "Mensagem"}
      </p>
      <p className="truncate text-[12px] text-[#d1d7db]">
        {replyPreview(message)}
      </p>
    </div>
  );
}

function StickerDetailsDialog({
  message,
  isSaving,
  alreadySaved,
  onClose,
  onSave,
}: {
  message: ChatMessage;
  isSaving: boolean;
  alreadySaved: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const creatorName =
    message.stickerOriginalCreatorName?.trim() || "Criador nao informado";
  const createdAt = message.stickerOriginalCreatedAt
    ? stickerDateLabel(message.stickerOriginalCreatedAt)
    : "Data nao informada";
  const title = message.stickerName?.trim() || "Figurinha";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 backdrop-blur-sm sm:items-center sm:pb-10"
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes da figurinha"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#111b21] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">
              Detalhes da figurinha
            </p>
            <p className="truncate text-xs text-[#aebac1]">{title}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4">
          <div className="grid place-items-center rounded-2xl bg-black/20 p-4">
            {message.stickerUrl && (
              <img
                src={resolveMediaUrl(message.stickerUrl)}
                alt={title}
                className="max-h-44 max-w-[180px] rounded-xl object-contain"
              />
            )}
          </div>

          <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <StickerDetailRow label="Criador original" value={creatorName} />
            <StickerDetailRow label="Criada em" value={createdAt} />
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Fechar
            </Button>
            {!alreadySaved && (
              <Button
                className="flex-1"
                disabled={!message.stickerId || isSaving}
                onClick={onSave}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Salvar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StickerDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase text-[#aebac1]">
          {label}
        </p>
        <p className="break-words text-[#e9edef]">{value}</p>
      </div>
    </div>
  );
}

function AudioMessage({
  src,
  duration,
  own,
}: {
  src: string;
  duration: number;
  own: boolean;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [loadedDuration, setLoadedDuration] = React.useState(duration);
  const totalDuration = Number.isFinite(loadedDuration)
    ? loadedDuration || duration || 0
    : duration || 0;
  const progress =
    totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0;
  const displayTime = isPlaying ? currentTime : totalDuration;
  const safeDisplayTime = Number.isFinite(displayTime) ? displayTime : 0;
  const bars = React.useMemo(
    () => [9, 6, 12, 16, 8, 13, 17, 10, 14, 7, 12, 16, 9, 13],
    [],
  );

  const togglePlayback = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  return (
    <div className="flex min-w-[182px] max-w-[66vw] items-center gap-2 py-0 sm:min-w-[210px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          setLoadedDuration(
            Number.isFinite(nextDuration) ? nextDuration : duration,
          );
        }}
        onTimeUpdate={(event) =>
          setCurrentTime(event.currentTarget.currentTime)
        }
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
      <button
        type="button"
        aria-label={isPlaying ? "Pausar audio" : "Reproduzir audio"}
        title={isPlaying ? "Pausar audio" : "Reproduzir audio"}
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full shadow-sm transition",
          own ? "bg-white text-[#005c4b]" : "bg-primary text-white",
        )}
        onClick={togglePlayback}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {isPlaying ? (
          <Pause className="h-3 w-3 fill-current" />
        ) : (
          <Play className="ml-0.5 h-3 w-3 fill-current" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-5 items-center gap-0.5" aria-hidden="true">
          {bars.map((height, index) => {
            const filled = index / bars.length <= progress;
            return (
              <span
                key={`${height}-${index}`}
                className={cn(
                  "w-0.5 rounded-full transition-colors",
                  filled
                    ? own
                      ? "bg-[#d7f7ee]"
                      : "bg-primary"
                    : "bg-white/25",
                )}
                style={{ height }}
              />
            );
          })}
        </div>
        <div
          className={cn(
            "text-[10px] leading-none",
            own ? "text-[#d7f7ee]" : "text-[#aebac1]",
          )}
        >
          {formatDuration(safeDisplayTime)}
        </div>
      </div>
    </div>
  );
}

function PollMessage({
  poll,
  own,
  onVote,
}: {
  poll: NonNullable<ChatMessage["poll"]>;
  own: boolean;
  onVote: (pollId: string, optionId: string) => void;
}) {
  const totalVotes =
    poll.totalVotes ??
    poll.options.reduce((total, option) => total + (option.votes ?? 0), 0);

  return (
    <div className="min-w-[230px] max-w-[330px]">
      <div className="mb-2 flex items-start gap-2">
        <BarChart3
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            own ? "text-[#d7f7ee]" : "text-primary",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap break-words text-[15px] font-semibold leading-[20px]">
            {poll.question}
          </p>
          {poll.allowsMultiple && (
            <p
              className={cn(
                "mt-0.5 text-[11px]",
                own ? "text-[#d7f7ee]" : "text-[#aebac1]",
              )}
            >
              Pode escolher mais de uma opcao
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {poll.options.map((option) => {
          const votes = option.votes ?? 0;
          const percent =
            totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

          return (
            <button
              key={option.id}
              type="button"
              className={cn(
                "relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left transition active:scale-[0.99]",
                own
                  ? "border-white/15 bg-black/15 hover:bg-black/20"
                  : "border-white/10 bg-black/10 hover:bg-white/[0.04]",
              )}
              onClick={(event) => {
                event.stopPropagation();
                onVote(poll.id, option.id);
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width]",
                  own ? "bg-[#8fe7cf]/25" : "bg-primary/20",
                )}
                style={{ width: `${percent}%` }}
                aria-hidden="true"
              />
              <span className="relative flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {option.body}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    own ? "text-[#d7f7ee]" : "text-[#cfe9ff]",
                  )}
                >
                  {percent}%
                </span>
                {option.votedByMe && (
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[#005c4b]">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p
        className={cn(
          "mt-2 text-[11px]",
          own ? "text-[#d7f7ee]" : "text-[#aebac1]",
        )}
      >
        {totalVotes} {totalVotes === 1 ? "voto" : "votos"}
      </p>
    </div>
  );
}

function PollComposer({
  onSubmit,
  onClose,
}: {
  onSubmit: (poll: {
    question: string;
    options: string[];
    allowsMultiple?: boolean;
  }) => void;
  onClose: () => void;
}) {
  const [question, setQuestion] = React.useState("");
  const [options, setOptions] = React.useState(["", ""]);
  const [allowsMultiple, setAllowsMultiple] = React.useState(false);
  const [error, setError] = React.useState("");

  const updateOption = (index: number, value: string) => {
    setOptions((current) =>
      current.map((option, currentIndex) =>
        currentIndex === index ? value : option,
      ),
    );
  };

  const removeOption = (index: number) => {
    setOptions((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const submit = () => {
    const cleanQuestion = question.trim();
    const cleanOptions = [
      ...new Set(options.map((option) => option.trim()).filter(Boolean)),
    ];

    if (cleanQuestion.length < 3) {
      setError("Escreva uma pergunta um pouco maior.");
      return;
    }
    if (cleanOptions.length < 2) {
      setError("Adicione pelo menos 2 opcoes.");
      return;
    }

    setError("");
    onSubmit({
      question: cleanQuestion,
      options: cleanOptions,
      allowsMultiple,
    });
    setQuestion("");
    setOptions(["", ""]);
    setAllowsMultiple(false);
  };

  return (
    <div className="border-t border-white/10 bg-[#111b21] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Enquete</p>
          <p className="truncate text-xs text-[#aebac1]">
            Pergunte algo para o grupo votar
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Fechar enquete"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Input
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Pergunta"
        className="mb-2 border-0 bg-[#202c33] focus:ring-0"
      />

      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={option}
              onChange={(event) => updateOption(index, event.target.value)}
              placeholder={`Opcao ${index + 1}`}
              className="border-0 bg-[#202c33] focus:ring-0"
            />
            {options.length > 2 && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Remover opcao"
                onClick={() => removeOption(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 rounded-full bg-[#202c33] px-3 py-2 text-xs text-[#d1d7db]">
          <input
            type="checkbox"
            checked={allowsMultiple}
            onChange={(event) => setAllowsMultiple(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-transparent"
          />
          Varias escolhas
        </label>
        <div className="flex items-center gap-2">
          {options.length < 6 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOptions((current) => [...current, ""])}
            >
              <Plus className="h-4 w-4" />
              Opcao
            </Button>
          )}
          <Button type="button" size="sm" onClick={submit}>
            <Send className="h-4 w-4" />
            Enviar
          </Button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-red-100">{error}</p>}
    </div>
  );
}

type StickerPackSummary = Omit<StickerPack, "stickers">;

function getClickToSendSetting() {
  try {
    return localStorage.getItem("sticker-click-to-send") !== "false";
  } catch {
    return true;
  }
}

function StickerTray({
  onPick,
  onClose,
}: {
  onPick: (sticker: Sticker) => void;
  onClose: () => void;
}) {
  const { data, isLoading } = useStickerPacks();
  const queryClient = useQueryClient();
  const [packName, setPackName] = React.useState("Favoritas");
  const [selectedPackId, setSelectedPackId] = React.useState<string | null>(
    null,
  );
  const [showPackForm, setShowPackForm] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [clickToSend, setClickToSend] = React.useState(getClickToSendSetting);
  const [editingPack, setEditingPack] = React.useState<StickerPackSummary | null>(null);
  const [editingPackName, setEditingPackName] = React.useState("");
  const [stickerMenuOpen, setStickerMenuOpen] = React.useState<string | null>(null);
  const [packMenuOpen, setPackMenuOpen] = React.useState<string | null>(null);
  const [packToDelete, setPackToDelete] = React.useState<StickerPack | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const stickerMenuRef = React.useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = React.useRef<number | null>(null);
  const packs = data?.packs ?? [];
  const firstPack = packs[0] ?? null;
  const selectedPack =
    packs.find((pack) => pack.id === selectedPackId) ?? firstPack;
  const visibleStickers =
    selectedPack?.stickers ?? packs.flatMap((pack) => pack.stickers);

  const invalidatePacks = () =>
    queryClient.invalidateQueries({ queryKey: ["stickers", "packs"] });

  React.useEffect(() => {
    if (!selectedPackId && firstPack) {
      setSelectedPackId(firstPack.id);
    }
  }, [firstPack, selectedPackId]);

  React.useEffect(() => {
    const close = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-sticker-tray]")) return;
      setStickerMenuOpen(null);
      setPackMenuOpen(null);
      setShowSettings(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const toggleClickToSend = () => {
    const next = !clickToSend;
    setClickToSend(next);
    try {
      localStorage.setItem("sticker-click-to-send", String(next));
    } catch { /* ignore */ }
  };

  const createPackRequest = async (name: string) => {
    const result = await api<{ pack: StickerPackSummary }>("/stickers/packs", {
      method: "POST",
      json: { name },
    });
    return result.pack;
  };

  const createPack = useMutation({
    mutationFn: createPackRequest,
    onSuccess: async (pack) => {
      setSelectedPackId(pack.id);
      setShowPackForm(false);
      setError("");
      await invalidatePacks();
    },
    onError: (packError) => {
      setError(
        packError instanceof Error
          ? packError.message
          : "Nao foi possivel criar o pacote.",
      );
    },
  });

  const renamePack = useMutation({
    mutationFn: ({ packId, name }: { packId: string; name: string }) =>
      api(`/stickers/packs/${packId}`, {
        method: "PATCH",
        json: { name },
      }),
    onSuccess: async () => {
      setEditingPack(null);
      setEditingPackName("");
      setPackMenuOpen(null);
      await invalidatePacks();
    },
    onError: (renameError) => {
      setError(
        renameError instanceof Error
          ? renameError.message
          : "Nao foi possivel renomear.",
      );
    },
  });

  const deletePack = useMutation({
    mutationFn: (packId: string) =>
      api(`/stickers/packs/${packId}`, { method: "DELETE" }),
    onSuccess: async () => {
      setPackMenuOpen(null);
      if (selectedPackId && packs.find((p) => p.id === selectedPackId)?.stickers.length === 0) {
        setSelectedPackId(null);
      }
      await invalidatePacks();
    },
    onError: (deleteError) => {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Nao foi possivel excluir o pacote.",
      );
    },
  });

  const deleteSticker = useMutation({
    mutationFn: (stickerId: string) =>
      api(`/stickers/${stickerId}`, { method: "DELETE" }),
    onSuccess: async () => {
      setStickerMenuOpen(null);
      await invalidatePacks();
    },
    onError: (delError) => {
      setError(
        delError instanceof Error
          ? delError.message
          : "Nao foi possivel excluir a figurinha.",
      );
    },
  });

  const moveSticker = useMutation({
    mutationFn: ({ stickerId, packId }: { stickerId: string; packId: string }) =>
      api(`/stickers/${stickerId}/move`, {
        method: "PATCH",
        json: { packId },
      }),
    onSuccess: async () => {
      setStickerMenuOpen(null);
      await invalidatePacks();
    },
    onError: (moveError) => {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Nao foi possivel mover a figurinha.",
      );
    },
  });

  const createPackFromInput = () => {
    const name = packName.trim();
    if (name.length < 2) {
      setError("O nome do pacote precisa ter pelo menos 2 caracteres.");
      return;
    }
    createPack.mutate(name);
  };

  const uploadSticker = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      let packId = selectedPack?.id;
      if (!packId) {
        const createdPack = await createPackRequest(
          packName.trim().length >= 2 ? packName.trim() : "Favoritas",
        );
        packId = createdPack.id;
        setSelectedPackId(packId);
      }

      const uploaded = await uploadFile("sticker", file);
      await api(`/stickers/packs/${packId}/stickers`, {
        method: "POST",
        json: {
          uploadId: uploaded.upload.id,
          name: file.name.replace(/\.[a-z0-9]+$/i, ""),
        },
      });
      await invalidatePacks();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Nao foi possivel enviar a figurinha.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleStickerClick = (sticker: Sticker) => {
    clearLongPress();
    if (clickToSend) {
      onPick(sticker);
    } else {
      setStickerMenuOpen(sticker.id);
    }
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const otherPacks = packs.filter((pack) => pack.id !== selectedPack?.id);
  const activeSticker = visibleStickers.find((s) => s.id === stickerMenuOpen) ?? null;
  const activePack = packs.find((p) => p.id === packMenuOpen) ?? null;

  return (
    <div className="mx-2 mt-2 rounded-2xl border border-white/10 bg-[#111b21] p-2.5 shadow-2xl" data-sticker-tray>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={uploadSticker}
      />

      <div className="flex items-center gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">Figurinhas</p>
          {editingPack ? (
            <p className="truncate text-[11px] text-[#aebac1]">Renomeando...</p>
          ) : (
            <p className="truncate text-[11px] text-[#aebac1]">
              {selectedPack
                ? `${selectedPack.name} (${selectedPack.stickers.length})`
                : "Crie ou envie sua primeira figurinha"}
            </p>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              aria-label="Configurar figurinhas"
              title="Configurar"
              onClick={() => setShowSettings((v) => !v)}
            >
              <span className="text-sm font-bold text-[#aebac1]">
                {clickToSend ? "\u2699" : "\u2699\uFE0F"}
              </span>
            </Button>
            {showSettings && (
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-white/10 bg-[#182229] p-2 shadow-2xl"
                   onPointerDown={(event) => event.stopPropagation()}>
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase text-[#8696a0]">
                  Envio de figurinha
                </p>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition hover:bg-white/[0.06]",
                    clickToSend ? "text-[#e9edef]" : "text-[#e9edef]",
                  )}
                  onClick={() => {
                    toggleClickToSend();
                    setShowSettings(false);
                  }}
                >
                  <Check className={cn("h-3.5 w-3.5", !clickToSend && "invisible")} />
                  Enviar ao tocar
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition hover:bg-white/[0.06]",
                    !clickToSend ? "text-[#e9edef]" : "text-[#e9edef]",
                  )}
                  onClick={() => {
                    toggleClickToSend();
                    setShowSettings(false);
                  }}
                >
                  <Check className={cn("h-3.5 w-3.5", clickToSend && "invisible")} />
                  Pedir confirmacao
                </button>
              </div>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full"
            aria-label="Nova figurinha"
            title="Nova figurinha"
            disabled={uploading || isLoading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant={showPackForm ? "secondary" : "ghost"}
            className="h-8 w-8 rounded-full"
            aria-label="Criar pacote"
            title="Criar pacote"
            onClick={() => {
              setError("");
              setShowPackForm((value) => !value);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full"
            aria-label="Fechar figurinhas"
            title="Fechar"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {packs.length > 0 && (
        <div className="thin-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {packs.map((pack) => (
            <div key={pack.id} className="relative shrink-0">
              <button
                type="button"
                className={cn(
                  "h-8 rounded-full px-3 text-xs font-semibold transition",
                  selectedPack?.id === pack.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-[#202c33] text-[#aebac1] hover:bg-[#2a3942] hover:text-white",
                )}
                onClick={() => {
                  setSelectedPackId(pack.id);
                  setPackMenuOpen(null);
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  clearLongPress();
                  longPressTimerRef.current = window.setTimeout(() => {
                    setPackMenuOpen(pack.id);
                  }, 500);
                }}
                onPointerUp={clearLongPress}
                onPointerLeave={clearLongPress}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setPackMenuOpen(pack.id);
                }}
              >
                {pack.name}
              </button>
            </div>
          ))}
        </div>
      )}

      {editingPack && (
        <form
          className="mt-2 flex gap-1.5 rounded-xl bg-[#202c33] p-1.5"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            renamePack.mutate({ packId: editingPack.id, name: editingPackName });
          }}
        >
          <textarea
            rows={1}
            value={editingPackName}
            onChange={(event) => setEditingPackName(event.target.value)}
            placeholder="Nome do pacote"
            className="h-9 min-w-0 flex-1 resize-none border-0 bg-transparent text-sm leading-9 text-foreground outline-none focus:ring-0"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
          />
          <Button
            type="submit"
            size="icon"
            variant="secondary"
            className="h-9 w-9 shrink-0 rounded-full"
            aria-label="Salvar"
            disabled={renamePack.isPending}
          >
            {renamePack.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 rounded-full"
            aria-label="Cancelar"
            onClick={() => {
              setEditingPack(null);
              setEditingPackName("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </form>
      )}

      {showPackForm && (
        <form
          className="mt-2 flex gap-1.5 rounded-xl bg-[#202c33] p-1.5"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            createPackFromInput();
          }}
        >
          <textarea
            rows={1}
            value={packName}
            onChange={(event) => setPackName(event.target.value)}
            placeholder="Novo pacote"
            className="h-9 min-w-0 flex-1 resize-none border-0 bg-transparent text-sm leading-9 text-foreground outline-none focus:ring-0"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
          />
          <Button
            type="submit"
            size="icon"
            variant="secondary"
            className="h-9 w-9 shrink-0 rounded-full"
            aria-label="Salvar pacote"
            disabled={createPack.isPending}
          >
            {createPack.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
        </form>
      )}

      {error && (
        <p className="mt-2 rounded-lg border border-red-400/[0.20] bg-red-500/[0.10] px-2.5 py-2 text-xs text-red-100">
          {error}
        </p>
      )}

      <div className="mt-2">
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-xl bg-[#202c33]" />
        ) : visibleStickers.length === 0 ? (
          <button
            type="button"
            className="w-full rounded-xl border border-dashed border-white/15 bg-[#202c33] px-3 py-3 text-center text-sm text-[#aebac1]"
            onClick={() => fileRef.current?.click()}
          >
            Toque para enviar sua primeira figurinha.
          </button>
        ) : (
          <div className="thin-scrollbar grid max-h-40 grid-cols-5 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-8">
            {visibleStickers.map((sticker) => (
              <div key={sticker.id} className="relative">
                <button
                  type="button"
                  aria-label={stickerMetaLabel(sticker)}
                  title={stickerMetaLabel(sticker)}
                  className="aspect-square min-h-0 w-full rounded-xl bg-[#202c33] p-1.5 transition hover:bg-[#2a3942]"
                  onClick={() => handleStickerClick(sticker)}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    clearLongPress();
                    longPressTimerRef.current = window.setTimeout(() => {
                      setStickerMenuOpen(sticker.id);
                    }, 500);
                  }}
                  onPointerUp={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onPointerCancel={clearLongPress}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <img
                    src={resolveMediaUrl(sticker.imageUrl)}
                    alt={sticker.name}
                    className="h-full w-full rounded-lg object-contain"
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeSticker && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setStickerMenuOpen(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-t-2xl border-t border-white/10 bg-[#111b21] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-3 py-3">
              <img
                src={resolveMediaUrl(activeSticker.imageUrl)}
                alt={activeSticker.name}
                className="h-12 w-12 rounded-lg bg-[#202c33] object-contain p-1"
              />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                {activeSticker.name}
              </p>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full"
                aria-label="Fechar"
                onClick={() => setStickerMenuOpen(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-2">
              {!clickToSend && (
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#e9edef] transition hover:bg-white/[0.06]"
                  onClick={() => {
                    onPick(activeSticker);
                    setStickerMenuOpen(null);
                  }}
                >
                  <Send className="h-4 w-4 text-primary" />
                  Enviar figurinha
                </button>
              )}
              {otherPacks.length > 0 && (
                <p className="px-2 pt-2 text-[10px] font-semibold uppercase text-[#8696a0]">
                  Mover para
                </p>
              )}
              {otherPacks.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#e9edef] transition hover:bg-white/[0.06]"
                  onClick={() =>
                    moveSticker.mutate({ stickerId: activeSticker.id, packId: pack.id })
                  }
                >
                  <Plus className="h-3.5 w-3.5 text-[#aebac1]" />
                  {pack.name}
                </button>
              ))}
              <div className="my-1 border-t border-white/10" />
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-200 transition hover:bg-white/[0.06]"
                onClick={() => deleteSticker.mutate(activeSticker.id)}
              >
                <Trash2 className="h-4 w-4" />
                Excluir figurinha
              </button>
            </div>
          </div>
        </div>
      )}

      {activePack && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPackMenuOpen(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-t-2xl border-t border-white/10 bg-[#111b21] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-3 py-3">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                {activePack.name}
              </p>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full"
                aria-label="Fechar"
                onClick={() => setPackMenuOpen(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#e9edef] transition hover:bg-white/[0.06]"
                onClick={() => {
                  setEditingPack(activePack);
                  setEditingPackName(activePack.name);
                  setPackMenuOpen(null);
                }}
              >
                <Pencil className="h-4 w-4 text-primary" />
                Renomear pacote
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-200 transition hover:bg-white/[0.06]"
                onClick={() => {
                  setPackToDelete(activePack);
                  setPackMenuOpen(null);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Excluir pacote
              </button>
            </div>
          </div>
        </div>
      )}

      {packToDelete && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setPackToDelete(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#111b21] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/20 text-red-300">
                <Trash2 className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">
                  Excluir pacote
                </p>
                <p className="truncate text-xs text-[#aebac1]">
                  {packToDelete.name}
                </p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm leading-relaxed text-[#d1d7db]">
                Tem certeza que deseja excluir este pacote? Esta acao nao pode
                ser desfeita.
              </p>
              {packToDelete.stickers !== undefined && packToDelete.stickers.length > 0 && (
                <p className="mt-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  Remova todas as figurinhas do pacote antes de exclui-lo.
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPackToDelete(null)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={deletePack.isPending}
                  onClick={() => {
                    deletePack.mutate(packToDelete.id, {
                      onSuccess: () => setPackToDelete(null),
                    });
                  }}
                >
                  {deletePack.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AudioRecorder({
  disabled,
  onRecorded,
  onError,
}: {
  disabled: boolean;
  onRecorded: (file: File, duration: number) => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [recording, setRecording] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const startedAt = React.useRef(0);
  const maxTimerRef = React.useRef<number | null>(null);
  const elapsedTimerRef = React.useRef<number | null>(null);

  const clearRecordingTimers = () => {
    if (maxTimerRef.current) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  React.useEffect(
    () => () => {
      clearRecordingTimers();
      stopStream();
      const recorder = recorderRef.current;
      if (recorder?.state === "recording") {
        recorder.stop();
      }
    },
    [],
  );

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      try {
        recorder.requestData();
      } catch {
        // Some mobile browsers do not allow requesting data right before stop.
      }
      recorder.stop();
    }
  };

  const toggle = async () => {
    if (disabled || processing) {
      return;
    }
    if (recording) {
      stopRecording();
      return;
    }

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      onError("Este navegador nao permite gravar audio aqui.");
      return;
    }

    setProcessing(true);
    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      const chunks: BlobPart[] = [];
      startedAt.current = Date.now();
      setElapsed(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = () => {
        clearRecordingTimers();
        stopStream();
        recorderRef.current = null;
        setRecording(false);
        setProcessing(false);
        setElapsed(0);
        onError("A gravacao de audio falhou. Tente novamente.");
      };
      recorder.onstop = () => {
        clearRecordingTimers();
        stopStream();
        recorderRef.current = null;
        setRecording(false);
        setElapsed(0);

        const finalMimeType = recorder.mimeType || mimeType || "audio/webm";
        const duration = Math.min(
          MAX_AUDIO_DURATION_SECONDS,
          Math.max(1, (Date.now() - startedAt.current) / 1000),
        );

        if (chunks.length === 0) {
          setProcessing(false);
          onError("O audio ficou vazio. Tente gravar novamente.");
          return;
        }

        const blob = new Blob(chunks, { type: finalMimeType });
        const file = new File(
          [blob],
          `audio-${Date.now()}${audioExtensionFromMimeType(finalMimeType)}`,
          {
            type: finalMimeType,
          },
        );

        setProcessing(true);
        void Promise.resolve(onRecorded(file, duration))
          .catch((error) => {
            onError(
              error instanceof Error
                ? error.message
                : "Nao foi possivel enviar o audio.",
            );
          })
          .finally(() => setProcessing(false));
      };

      recorderRef.current = recorder;
      recorder.start(500);
      setRecording(true);
      setProcessing(false);
      elapsedTimerRef.current = window.setInterval(() => {
        setElapsed(
          Math.min(
            MAX_AUDIO_DURATION_SECONDS,
            Math.floor((Date.now() - startedAt.current) / 1000),
          ),
        );
      }, 250);
      maxTimerRef.current = window.setTimeout(
        stopRecording,
        MAX_AUDIO_DURATION_SECONDS * 1000,
      );
    } catch (error) {
      clearRecordingTimers();
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      setProcessing(false);
      setElapsed(0);
      onError(audioRecorderErrorMessage(error));
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {recording && (
        <span className="rounded-full bg-red-500/15 px-2 py-1 text-[11px] font-semibold text-red-100">
          {formatDuration(elapsed)} / 2:00
        </span>
      )}
      <Button
        type="button"
        size="icon"
        variant={recording ? "secondary" : "default"}
        aria-label={recording ? "Parar gravacao" : "Gravar audio"}
        disabled={disabled || processing}
        onClick={toggle}
        className="h-11 w-11 shrink-0 rounded-full"
      >
        {processing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}

function DayDivider({ value }: { value: string }) {
  return (
    <div className="my-2 flex justify-center">
      <span className="rounded-full bg-[#182229]/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[#aebac1] shadow-sm">
        {dayLabel(value)}
      </span>
    </div>
  );
}

function dayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isInteractiveTarget(target: EventTarget) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("button, a, input, textarea, select, audio"))
  );
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dayKey(value) === dayKey(today.toISOString())) return "Hoje";
  if (dayKey(value) === dayKey(yesterday.toISOString())) return "Ontem";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function stickerMetaLabel(
  sticker:
    | Pick<Sticker, "name" | "originalCreatorName" | "originalCreatedAt">
    | {
        originalCreatorName?: string | null | undefined;
        originalCreatedAt?: string | null | undefined;
      },
) {
  const creatorName = sticker.originalCreatorName?.trim();
  const createdAt = sticker.originalCreatedAt
    ? stickerDateLabel(sticker.originalCreatedAt)
    : "";
  const fallback = "name" in sticker ? sticker.name : "Figurinha";

  if (creatorName && createdAt)
    return `Criada por ${creatorName} - ${createdAt}`;
  if (creatorName) return `Criada por ${creatorName}`;
  if (createdAt) return `Criada em ${createdAt}`;
  return fallback;
}

function stickerDateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function replyPreview(message: ChatMessage) {
  if (message.type === "sticker") return "Figurinha";
  if (message.type === "audio") return "Audio";
  if (message.type === "image") return "Imagem";
  if (message.type === "poll") return message.poll?.question ?? "Enquete";
  return message.body || "Mensagem";
}

function groupReactions(reactions: MessageReaction[]) {
  const grouped = new Map<string, { emoji: string; count: number }>();
  for (const r of reactions) {
    const existing = grouped.get(r.emoji);
    if (existing) {
      existing.count++;
    } else {
      grouped.set(r.emoji, { emoji: r.emoji, count: 1 });
    }
  }
  return Array.from(grouped.values());
}
