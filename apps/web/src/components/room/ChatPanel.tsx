import * as React from "react";
import {
  ChevronDown,
  Copy,
  Heart,
  ImagePlus,
  Mic,
  Paperclip,
  Pause,
  Pin,
  Play,
  Reply,
  Send,
  Smile,
  Trash2,
  X
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ChatMessage, Participant, Sticker, StickerPack } from "@/services/types";
import { api, resolveMediaUrl, uploadFile } from "@/services/api";
import { useStickerPacks } from "@/hooks/useApi";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDuration } from "@/lib/utils";

const MAX_AUDIO_DURATION_SECONDS = 120;

type Props = {
  roomName: string;
  onlineCount: number;
  messages: ChatMessage[];
  currentUserId: string;
  participant: Participant | null;
  canModerate: boolean;
  className?: string;
  onOpenRoomInfo: () => void;
  onSend: (payload: {
    type: "text" | "sticker" | "audio";
    body?: string | undefined;
    replyToMessageId?: string | null | undefined;
    stickerId?: string | null | undefined;
    audioUploadId?: string | null | undefined;
    audioDurationSeconds?: number | undefined;
  }) => void;
  onLike: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onPin: (messageId: string, isPinned: boolean) => void;
};

export function ChatPanel({
  roomName,
  onlineCount,
  messages,
  currentUserId,
  participant,
  canModerate,
  className,
  onOpenRoomInfo,
  onSend,
  onLike,
  onDelete,
  onPin
}: Props) {
  const [body, setBody] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);
  const [openActionsId, setOpenActionsId] = React.useState<string | null>(null);
  const [showStickers, setShowStickers] = React.useState(false);
  const messagesViewportRef = React.useRef<HTMLDivElement | null>(null);
  const messageBoxRef = React.useRef<HTMLTextAreaElement | null>(null);
  const touchSendHandledRef = React.useRef(false);
  const messageById = React.useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

  const scrollMessagesToBottom = React.useCallback((behavior: ScrollBehavior = "auto") => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  }, []);

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
    const closeActions = () => setOpenActionsId(null);
    document.addEventListener("pointerdown", closeActions);
    return () => document.removeEventListener("pointerdown", closeActions);
  }, []);

  const canChat = Boolean(participant?.canChat && !participant.isMuted && !participant.isBanned);

  const submit = React.useCallback(() => {
    if (!body.trim() || !canChat) return;
    onSend({
      type: "text",
      body: body.trim(),
      replyToMessageId: replyTo?.id
    });
    setBody("");
    setReplyTo(null);
    window.requestAnimationFrame(() => {
      messageBoxRef.current?.focus({ preventScroll: true });
    });
  }, [body, canChat, onSend, replyTo?.id]);

  let previousDay = "";

  return (
    <Card
      className={cn(
        "room-chat-panel flex h-[min(760px,calc(100vh-96px))] min-h-[360px] flex-col overflow-hidden border-white/10 bg-[#0b141a] shadow-2xl max-sm:h-[min(520px,56svh)] max-sm:min-h-[320px]",
        className
      )}
    >
      <div className="room-chat-header flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-[#111b21] px-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition hover:bg-white/[0.04]"
          onClick={onOpenRoomInfo}
        >
          <span className="relative shrink-0">
            <Avatar name={roomName} className="h-11 w-11 rounded-full border-primary/30 bg-primary/[0.16]" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#111b21] bg-emerald-400" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">{roomName}</span>
            <span className="block truncate text-xs text-[#aebac1]">{onlineCount} online</span>
          </span>
        </button>
        <Badge variant={canChat ? "default" : "destructive"} className="rounded-full">
          {canChat ? "chat" : "restrito"}
        </Badge>
      </div>

      <CardContent className="room-chat-body flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div
          ref={messagesViewportRef}
          className="room-chat-messages thin-scrollbar min-h-0 flex-1 overscroll-contain overflow-y-auto scroll-pb-4 bg-[#071014] p-3 pb-4"
        >
          <div className="space-y-1.5">
            {messages.map((message) => {
              const day = dayKey(message.createdAt);
              const showDay = day !== previousDay;
              previousDay = day;

              return (
                <React.Fragment key={message.id}>
                  {showDay && <DayDivider value={message.createdAt} />}
                  <MessageBubble
                    message={message}
                    replyToMessage={
                      message.replyToMessageId ? messageById.get(message.replyToMessageId) ?? null : null
                    }
                    own={message.userId === currentUserId}
                    canModerate={canModerate}
                    actionsOpen={openActionsId === message.id}
                    onToggleActions={() =>
                      setOpenActionsId((current) => (current === message.id ? null : message.id))
                    }
                    onReply={() => {
                      setReplyTo(message);
                      setOpenActionsId(null);
                    }}
                    onCopy={() => {
                      if (message.body) {
                        void navigator.clipboard.writeText(message.body);
                      }
                      setOpenActionsId(null);
                    }}
                    onLike={() => {
                      onLike(message.id);
                      setOpenActionsId(null);
                    }}
                    onDelete={() => {
                      onDelete(message.id);
                      setOpenActionsId(null);
                    }}
                    onPin={() => {
                      onPin(message.id, !message.isPinned);
                      setOpenActionsId(null);
                    }}
                  />
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="room-chat-composer sticky bottom-0 z-30 shrink-0 border-t border-white/10 bg-[#0b141a]/98 shadow-[0_-12px_24px_rgba(0,0,0,0.22)] backdrop-blur max-sm:static">
          {replyTo && (
            <div className="px-3 pt-2">
              <div className="flex items-center gap-2 rounded-lg border-l-4 border-primary bg-white/[0.06] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-primary">{replyTo.authorName ?? "Mensagem"}</p>
                  <p className="truncate text-xs text-[#aebac1]">{replyPreview(replyTo)}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Cancelar resposta" onClick={() => setReplyTo(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {showStickers && (
            <StickerTray
              onPick={(sticker) => {
                onSend({ type: "sticker", stickerId: sticker.id, replyToMessageId: replyTo?.id });
                setReplyTo(null);
                setShowStickers(false);
              }}
            />
          )}

          <div className="p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
            <div className="flex items-end gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Figurinhas"
                className="h-11 w-11 shrink-0 rounded-full text-[#aebac1]"
                onClick={() => setShowStickers((value) => !value)}
              >
                <Smile className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1 rounded-[22px] bg-[#202c33] px-1">
                <Textarea
                  ref={messageBoxRef}
                  rows={1}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  disabled={!canChat}
                  placeholder={canChat ? "Mensagem" : "Chat restrito"}
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
                  className="max-h-24 min-h-11 overflow-y-auto rounded-[22px] border-0 bg-transparent px-3 py-2.5 text-[15px] leading-6 focus:ring-0"
                />
              </div>
              {body.trim() ? (
                <Button
                  type="button"
                  size="icon"
                  aria-label="Enviar"
                  disabled={!canChat}
                  className="h-11 w-11 shrink-0 rounded-full"
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
                  <Send className="h-5 w-5" />
                </Button>
              ) : (
                <AudioRecorder
                  disabled={!participant?.canSendAudio || !canChat}
                  onRecorded={(file, duration) =>
                    uploadFile("audio", file).then((result) =>
                      onSend({ type: "audio", audioUploadId: result.upload.id, audioDurationSeconds: duration })
                    )
                  }
                />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MessageBubble({
  message,
  replyToMessage,
  own,
  canModerate,
  actionsOpen,
  onToggleActions,
  onReply,
  onCopy,
  onLike,
  onDelete,
  onPin
}: {
  message: ChatMessage;
  replyToMessage: ChatMessage | null;
  own: boolean;
  canModerate: boolean;
  actionsOpen: boolean;
  onToggleActions: () => void;
  onReply: () => void;
  onCopy: () => void;
  onLike: () => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  const [dragX, setDragX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const pointerStart = React.useRef<{ x: number; y: number; id: number } | null>(null);
  const longPressTimer = React.useRef<number | null>(null);
  const canDelete = own || canModerate;
  const canCopy = Boolean(message.body);
  const dragDirection = own ? -1 : 1;

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isInteractiveTarget(event.target)) return;
    pointerStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    longPressTimer.current = window.setTimeout(() => {
      pointerStart.current = null;
      setDragX(0);
      setIsDragging(false);
      onToggleActions();
    }, 520);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current || pointerStart.current.id !== event.pointerId) return;

    const deltaX = (event.clientX - pointerStart.current.x) * dragDirection;
    const deltaY = Math.abs(event.clientY - pointerStart.current.y);

    if (deltaY > 28 && deltaX < 14) {
      clearLongPress();
      return;
    }

    const next = Math.max(0, Math.min(72, deltaX));
    if (next > 6) {
      clearLongPress();
      setIsDragging(true);
      setDragX(next * dragDirection);
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    clearLongPress();
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

  return (
    <div className={cn("group relative flex items-end gap-2 py-0.5", own ? "justify-end" : "justify-start")}>
      {isDragging && (
        <div
          className={cn(
            "absolute top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-primary/90 text-white shadow-lg transition",
            own ? "right-3" : "left-10"
          )}
        >
          <Reply className="h-4 w-4" />
        </div>
      )}

      {!own && <Avatar src={message.authorImage} name={message.authorName} className="h-7 w-7 rounded-full" />}

      <div
        className={cn("max-w-[min(82%,430px)] touch-pan-y", own ? "ml-12" : "mr-12")}
        style={{ transform: `translateX(${dragX}px)`, transition: isDragging ? "none" : "transform 160ms ease" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          className={cn(
            "relative min-w-0 rounded-2xl shadow-sm ring-1 ring-white/[0.03]",
            message.type === "sticker" && "p-1.5",
            message.type === "audio" && "px-2.5 py-1.5",
            message.type !== "sticker" && message.type !== "audio" && "px-3 py-2",
            own
              ? "rounded-br-md bg-[#005c4b] text-white"
              : "rounded-bl-md bg-[#202c33] text-[#e9edef]"
          )}
        >
          <span
            className={cn(
              "absolute bottom-0 h-3 w-3",
              own
                ? "-right-1 bg-[#005c4b] [clip-path:polygon(0_0,100%_100%,0_100%)]"
                : "-left-1 bg-[#202c33] [clip-path:polygon(100%_0,100%_100%,0_100%)]"
            )}
          />

          {!own && (
            <p className="mb-0.5 truncate text-[12px] font-bold text-primary">
              {message.authorName ?? "Participante"}
            </p>
          )}

          {message.isPinned && (
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] text-amber-100">
              <Pin className="h-3 w-3" />
              Fixada
            </div>
          )}

          {replyToMessage && <ReplySnippet message={replyToMessage} own={own} />}

          {message.type === "text" && (
            <p className="whitespace-pre-wrap break-words pr-1 text-[14.5px] leading-snug">{message.body}</p>
          )}
          {message.type === "sticker" && message.stickerUrl && (
            <div className="rounded-xl bg-black/10 p-1">
              <img
                src={resolveMediaUrl(message.stickerUrl)}
                alt={message.stickerName ?? "Figurinha"}
                className="h-36 w-36 rounded-lg object-contain sm:h-40 sm:w-40"
              />
            </div>
          )}
          {message.type === "audio" && message.audioUrl && (
            <AudioMessage src={resolveMediaUrl(message.audioUrl)} duration={message.audioDuration ?? 0} own={own} />
          )}

          <div
            className={cn(
              "mt-1 flex items-center gap-1 text-[11px]",
              own ? "justify-end text-[#d7f7ee]" : "justify-end text-[#aebac1]"
            )}
          >
            {Boolean(message.likes) && (
              <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-black/20 px-1.5 py-0.5">
                <Heart className="h-3 w-3 fill-current" />
                {message.likes}
              </span>
            )}
            <span>{timeLabel(message.createdAt)}</span>
          </div>

          <button
            type="button"
            aria-label="Opcoes da mensagem"
            className={cn(
              "absolute top-1 grid h-7 w-7 place-items-center rounded-full bg-black/15 text-[#d1d7db] opacity-0 transition hover:bg-black/25",
              own ? "left-1" : "right-1",
              actionsOpen && "opacity-100",
              "group-hover:opacity-100 group-focus-within:opacity-100"
            )}
            onClick={(event) => {
              event.stopPropagation();
              onToggleActions();
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <ChevronDown className="h-4 w-4" />
          </button>

          {actionsOpen && (
            <CompactActionMenu
              own={own}
              canCopy={canCopy}
              canModerate={canModerate}
              canDelete={canDelete}
              isPinned={message.isPinned}
              onReply={onReply}
              onLike={onLike}
              onCopy={onCopy}
              onPin={onPin}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ReplySnippet({ message, own }: { message: ChatMessage; own: boolean }) {
  return (
    <div
      className={cn(
        "mb-1.5 min-w-0 rounded-lg border-l-4 px-2.5 py-1.5",
        own ? "border-[#8fe7cf] bg-black/20" : "border-primary bg-black/15"
      )}
    >
      <p className={cn("truncate text-[11px] font-bold", own ? "text-[#baf7e9]" : "text-primary")}>
        {message.authorName ?? "Mensagem"}
      </p>
      <p className="truncate text-[12px] text-[#d1d7db]">{replyPreview(message)}</p>
    </div>
  );
}

function AudioMessage({ src, duration, own }: { src: string; duration: number; own: boolean }) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [loadedDuration, setLoadedDuration] = React.useState(duration);
  const totalDuration = Number.isFinite(loadedDuration) ? loadedDuration || duration || 0 : duration || 0;
  const progress = totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0;
  const displayTime = isPlaying ? currentTime : totalDuration;
  const safeDisplayTime = Number.isFinite(displayTime) ? displayTime : 0;
  const bars = React.useMemo(() => [12, 8, 15, 20, 10, 17, 22, 13, 18, 9, 16, 21, 11, 17, 23, 13, 19, 10], []);

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
    <div className="flex min-w-[205px] max-w-[72vw] items-center gap-2 py-0 sm:min-w-[235px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          setLoadedDuration(Number.isFinite(nextDuration) ? nextDuration : duration);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
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
          "grid h-8 w-8 shrink-0 place-items-center rounded-full shadow-sm transition",
          own ? "bg-white text-[#005c4b]" : "bg-primary text-white"
        )}
        onClick={togglePlayback}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-6 items-center gap-0.5" aria-hidden="true">
          {bars.map((height, index) => {
            const filled = index / bars.length <= progress;
            return (
              <span
                key={`${height}-${index}`}
                className={cn(
                  "w-1 rounded-full transition-colors",
                  filled ? (own ? "bg-[#d7f7ee]" : "bg-primary") : "bg-white/25"
                )}
                style={{ height }}
              />
            );
          })}
        </div>
        <div className={cn("text-[10px] leading-none", own ? "text-[#d7f7ee]" : "text-[#aebac1]")}>
          {formatDuration(safeDisplayTime)}
        </div>
      </div>
    </div>
  );
}

function CompactActionMenu({
  own,
  canCopy,
  canModerate,
  canDelete,
  isPinned,
  onReply,
  onLike,
  onCopy,
  onPin,
  onDelete
}: {
  own: boolean;
  canCopy: boolean;
  canModerate: boolean;
  canDelete: boolean;
  isPinned: boolean;
  onReply: () => void;
  onLike: () => void;
  onCopy: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute -top-11 z-40 flex w-max max-w-[calc(100vw-32px)] items-center gap-1 rounded-full bg-[#233138] p-1 text-[#e9edef] shadow-2xl ring-1 ring-black/40",
        own ? "right-0" : "left-0"
      )}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ActionIconButton icon={<Reply className="h-4 w-4" />} label="Responder" onClick={onReply} />
      <ActionIconButton icon={<Heart className="h-4 w-4" />} label="Curtir" onClick={onLike} />
      {canCopy && <ActionIconButton icon={<Copy className="h-4 w-4" />} label="Copiar" onClick={onCopy} />}
      {canModerate && (
        <ActionIconButton
          icon={<Pin className="h-4 w-4" />}
          label={isPinned ? "Desfixar" : "Fixar"}
          onClick={onPin}
        />
      )}
      {canDelete && (
        <ActionIconButton icon={<Trash2 className="h-4 w-4" />} label="Excluir" onClick={onDelete} destructive />
      )}
    </div>
  );
}

function ActionIconButton({
  icon,
  label,
  onClick,
  destructive = false
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/[0.08]",
        destructive ? "text-red-200" : "text-[#d1d7db]"
      )}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

type StickerPackSummary = Omit<StickerPack, "stickers">;

function StickerTray({ onPick }: { onPick: (sticker: Sticker) => void }) {
  const { data, isLoading } = useStickerPacks();
  const queryClient = useQueryClient();
  const [packName, setPackName] = React.useState("Favoritas");
  const [selectedPackId, setSelectedPackId] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const packs = data?.packs ?? [];
  const firstPack = packs[0] ?? null;
  const selectedPack = packs.find((pack) => pack.id === selectedPackId) ?? firstPack;
  const visibleStickers = selectedPack?.stickers ?? packs.flatMap((pack) => pack.stickers);

  React.useEffect(() => {
    if (!selectedPackId && firstPack) {
      setSelectedPackId(firstPack.id);
    }
  }, [firstPack, selectedPackId]);

  const createPackRequest = async (name: string) => {
    const result = await api<{ pack: StickerPackSummary }>("/stickers/packs", {
      method: "POST",
      json: { name }
    });
    return result.pack;
  };

  const createPack = useMutation({
    mutationFn: createPackRequest,
    onSuccess: async (pack) => {
      setSelectedPackId(pack.id);
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["stickers", "packs"] });
    },
    onError: (packError) => {
      setError(packError instanceof Error ? packError.message : "Nao foi possivel criar o pacote.");
    }
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
        const createdPack = await createPackRequest(packName.trim().length >= 2 ? packName.trim() : "Favoritas");
        packId = createdPack.id;
        setSelectedPackId(packId);
      }

      const uploaded = await uploadFile("sticker", file);
      await api(`/stickers/packs/${packId}/stickers`, {
        method: "POST",
        json: { uploadId: uploaded.upload.id, name: file.name.replace(/\.[a-z0-9]+$/i, "") }
      });
      await queryClient.invalidateQueries({ queryKey: ["stickers", "packs"] });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Nao foi possivel enviar a figurinha.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border-t border-white/10 bg-[#111b21] p-3">
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={uploadSticker} />

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Figurinhas</p>
          <p className="truncate text-xs text-[#aebac1]">
            {selectedPack ? selectedPack.name : "Crie ou envie sua primeira figurinha"}
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={uploading || isLoading} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="h-4 w-4" />
          {uploading ? "Enviando" : "Nova"}
        </Button>
      </div>

      <div className="mb-3 flex gap-2 rounded-lg bg-[#202c33] p-2">
        {packs.length > 0 && (
          <select
            value={selectedPack?.id ?? ""}
            onChange={(event) => setSelectedPackId(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#111b21] px-2 text-sm text-white outline-none"
            aria-label="Pacote de figurinhas"
          >
            {packs.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </select>
        )}
        <Input
          value={packName}
          onChange={(event) => setPackName(event.target.value)}
          placeholder="Novo pacote"
          className="min-w-0 flex-1 border-0 bg-transparent focus:ring-0"
        />
        <Button size="sm" variant="ghost" disabled={createPack.isPending} onClick={createPackFromInput}>
          <Paperclip className="h-4 w-4" />
          Pacote
        </Button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-400/[0.20] bg-red-500/[0.10] p-2 text-xs text-red-100">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-[#202c33]" />
      ) : visibleStickers.length === 0 ? (
        <button
          type="button"
          className="w-full rounded-lg border border-dashed border-white/15 bg-[#202c33] p-4 text-center text-sm text-[#aebac1]"
          onClick={() => fileRef.current?.click()}
        >
          Nenhuma figurinha ainda. Toque para enviar uma imagem.
        </button>
      ) : (
        <div className="thin-scrollbar flex max-h-32 gap-2 overflow-x-auto">
          {visibleStickers.map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              className="h-20 w-20 shrink-0 rounded-lg bg-[#202c33] p-1 transition hover:bg-[#2a3942]"
              onClick={() => onPick(sticker)}
            >
              <img
                src={resolveMediaUrl(sticker.imageUrl)}
                alt={sticker.name}
                className="h-full w-full rounded-md object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AudioRecorder({
  disabled,
  onRecorded
}: {
  disabled: boolean;
  onRecorded: (file: File, duration: number) => void;
}) {
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
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

  React.useEffect(() => clearRecordingTimers, []);

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      recorder.stop();
    }
  };

  const toggle = async () => {
    if (recording) {
      stopRecording();
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    startedAt.current = Date.now();
    setElapsed(0);
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      clearRecordingTimers();
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: "audio/webm" });
      const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
      const duration = Math.min(MAX_AUDIO_DURATION_SECONDS, Math.max(1, (Date.now() - startedAt.current) / 1000));
      onRecorded(file, duration);
      setRecording(false);
      setElapsed(0);
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    elapsedTimerRef.current = window.setInterval(() => {
      setElapsed(Math.min(MAX_AUDIO_DURATION_SECONDS, Math.floor((Date.now() - startedAt.current) / 1000)));
    }, 250);
    maxTimerRef.current = window.setTimeout(stopRecording, MAX_AUDIO_DURATION_SECONDS * 1000);
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
        disabled={disabled}
        onClick={toggle}
        className="h-11 w-11 shrink-0 rounded-full"
      >
        <Mic className="h-5 w-5" />
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
  return target instanceof HTMLElement && Boolean(target.closest("button, a, input, textarea, select, audio"));
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
    month: "short"
  }).format(date);
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function replyPreview(message: ChatMessage) {
  if (message.type === "sticker") return "Figurinha";
  if (message.type === "audio") return "Audio";
  return message.body || "Mensagem";
}
