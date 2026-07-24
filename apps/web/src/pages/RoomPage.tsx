import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import {
  AlertTriangle,
  ChevronLeft,
  Clock3,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  MessageCircleOff,
  ShieldCheck,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ChatMessage,
  Participant,
  PlaybackState,
  Room,
  RoomContent,
  RoomMessageRankingItem,
  RoomPayload,
} from "@/services/types";
import { API_URL, api, resolveMediaUrl } from "@/services/api";
import { useMe, useRoom } from "@/hooks/useApi";
import { WatchPlayer } from "@/components/room/WatchPlayer";
import { ChatPanel } from "@/components/room/ChatPanel";
import { ParticipantsPanel } from "@/components/room/ParticipantsPanel";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useRadioPlayer } from "@/contexts/RadioPlayerContext";
import { createMediaBackgroundStyle } from "@/lib/media";
import { cn } from "@/lib/utils";
import { markRoomJoined } from "@/utils/joined-rooms";

export function RoomPage() {
  const { slug = "" } = useParams();
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const initial = useRoom(slug);
  const [room, setRoom] = React.useState<Room | null>(null);
  const [participant, setParticipant] = React.useState<Participant | null>(
    null,
  );
  const [contents, setContents] = React.useState<RoomContent[]>([]);
  const [playback, setPlayback] = React.useState<PlaybackState | null>(null);
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [messageCount, setMessageCount] = React.useState(0);
  const [messageRanking, setMessageRanking] = React.useState<
    RoomMessageRankingItem[]
  >([]);
  const [messageRetentionDays, setMessageRetentionDays] = React.useState<
    number | null
  >(null);
  const [toast, setToast] = React.useState<{
    message: string;
    tone: "error" | "info";
  } | null>(null);
  const [roomInfoOpen, setRoomInfoOpen] = React.useState(false);
  const [retentionInfoOpen, setRetentionInfoOpen] = React.useState(false);
  const [messagesHidden, setMessagesHidden] = React.useState(false);
  const roomViewportRef = React.useRef<HTMLElement | null>(null);
  const socketRef = React.useRef<Socket | null>(null);
  const radio = useRadioPlayer();
  const activeRadioUrl = radio.currentUrl;
  const stopRadio = radio.stop;
  const roomRadioUrl =
    room?.type === "group" && room.radioEnabled && room.radioUrl
      ? resolveMediaUrl(room.radioUrl)
      : "";

  const applyPayload = React.useCallback((payload: RoomPayload) => {
    setRoom(payload.room);
    setParticipant(payload.participant);
    setContents(payload.contents);
    setPlayback(payload.playback);
    setParticipants(payload.participants);
    setMessages(payload.messages);
    setMessageCount(payload.messageCount ?? payload.messages.length);
    setMessageRanking(payload.messageRanking ?? []);
    setMessageRetentionDays(payload.messageRetentionDays ?? null);
    setRetentionInfoOpen(false);
  }, []);

  const showToast = React.useCallback(
    (message: string, tone: "error" | "info" = "info") => {
      setToast({ message, tone });
      window.setTimeout(() => setToast(null), 2500);
    },
    [],
  );

  const joinRoomMutation = useMutation({
    mutationFn: () => {
      if (!room) {
        throw new Error("Sala indisponivel");
      }
      return api<RoomPayload>(`/rooms/${room.id}/join`, { method: "POST" });
    },
    onSuccess: (payload) => {
      applyPayload(payload);
      markRoomJoined(me?.user.id, payload.room.slug);
      queryClient.setQueryData<{ rooms: Room[] }>(["rooms"], (current) => {
        if (!current) return current;
        return {
          rooms: current.rooms.map((item) =>
            item.id === payload.room.id ? { ...item, hasJoined: true } : item,
          ),
        };
      });
      void queryClient.invalidateQueries({ queryKey: ["rooms"] });
      showToast("Entrada confirmada. Bem-vindo ao chat.", "info");
    },
    onError: (error) => {
      showToast(
        error instanceof Error
          ? error.message
          : "Nao foi possivel entrar na sala",
        "error",
      );
    },
  });

  React.useEffect(() => {
    if (initial.data) {
      applyPayload(initial.data);
    }
  }, [initial.data, applyPayload]);

  React.useEffect(() => {
    if (me?.user.id && room?.slug && participant) {
      markRoomJoined(me.user.id, room.slug);
    }
  }, [me?.user.id, participant, room?.slug]);

  React.useEffect(() => {
    if (room?.type === "rave" && activeRadioUrl) {
      stopRadio();
    }
  }, [activeRadioUrl, room?.type, stopRadio]);

  React.useEffect(() => {
    const target = roomViewportRef.current;
    if (!target) return;

    const syncViewport = () => {
      const viewport = window.visualViewport;
      target.style.setProperty(
        "--room-visual-height",
        `${Math.round(viewport?.height ?? window.innerHeight)}px`,
      );
      target.style.setProperty(
        "--room-visual-top",
        `${Math.round(viewport?.offsetTop ?? 0)}px`,
      );
    };

    syncViewport();
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("orientationchange", syncViewport);

    return () => {
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
    };
  }, [room?.id]);

  React.useEffect(() => {
    if (!slug || !participant) return;

    const socket = io(API_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("room:join", { slug }));
    socket.on("room:state", (payload: RoomPayload) => applyPayload(payload));
    socket.on(
      "participants:update",
      (payload: { participants: Participant[] }) =>
        setParticipants(payload.participants),
    );
    socket.on("player:update", (payload: { playback: PlaybackState }) =>
      setPlayback(payload.playback),
    );
    socket.on(
      "chat:message",
      (payload: {
        message: ChatMessage;
        messageCount?: number;
        messageRanking?: RoomMessageRankingItem[];
      }) => {
        setMessages((value) => [
          ...value.filter((message) => message.id !== payload.message.id),
          payload.message,
        ]);
        setMessageCount((value) => payload.messageCount ?? value + 1);
        setMessageRanking((value) => payload.messageRanking ?? value);
      },
    );
    socket.on(
      "chat:delete",
      (payload: {
        messageId: string;
        messageCount?: number;
        messageRanking?: RoomMessageRankingItem[];
      }) => {
        setMessages((value) =>
          value.filter((message) => message.id !== payload.messageId),
        );
        setMessageCount(
          (value) => payload.messageCount ?? Math.max(0, value - 1),
        );
        setMessageRanking((value) => payload.messageRanking ?? value);
      },
    );
    socket.on("chat:likes", (payload: { messageId: string; likes: number }) =>
      setMessages((value) =>
        value.map((message) =>
          message.id === payload.messageId
            ? { ...message, likes: payload.likes }
            : message,
        ),
      ),
    );
    socket.on("chat:pin", (payload: { messageId: string; isPinned: boolean }) =>
      setMessages((value) =>
        value.map((message) =>
          message.id === payload.messageId
            ? { ...message, isPinned: payload.isPinned }
            : message,
        ),
      ),
    );
    socket.on(
      "poll:update",
      (payload: { poll: NonNullable<ChatMessage["poll"]> }) =>
        setMessages((value) =>
          value.map((message) =>
            message.pollId === payload.poll.id ||
            message.poll?.id === payload.poll.id
              ? { ...message, poll: payload.poll }
              : message,
          ),
        ),
    );
    socket.on("error:toast", (payload: { message: string }) => {
      showToast(payload.message, "error");
    });

    return () => {
      socket.emit("room:leave");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [slug, participant?.id, applyPayload, showToast]);

  const emitPlayback = React.useCallback(
    (patch: {
      contentId?: string | null;
      isPlaying: boolean;
      positionSeconds: number;
    }) => {
      socketRef.current?.emit("player:update", patch);
    },
    [],
  );

  if (
    !room &&
    (initial.isLoading ||
      initial.isPending ||
      initial.isFetching ||
      initial.data)
  ) {
    return (
      <div className="h-80 animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
    );
  }

  if (!room) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Sala indisponivel"
        description="Confira o link compartilhado ou peca um novo convite para o administrador."
      />
    );
  }

  const roomBackgroundStyle = createMediaBackgroundStyle(
    room.backgroundUrl,
    0.82,
  );

  if (!participant) {
    return (
      <RoomEntryGate
        room={room}
        messageCount={messageCount}
        isJoining={joinRoomMutation.isPending}
        onJoin={() => joinRoomMutation.mutate()}
        backgroundStyle={roomBackgroundStyle}
        toast={toast}
      />
    );
  }

  const activeContent =
    contents.find((content) => content.id === playback?.contentId) ??
    contents.find((content) => content.isActive) ??
    null;
  const onlineCount = participants.filter((item) => item.online).length;
  const isGroup = room.type === "group";
  const messagesAreHidden = !isGroup && messagesHidden;
  const hasMessageRetention =
    typeof messageRetentionDays === "number" && messageRetentionDays > 0;
  const messageRetentionNotice = hasMessageRetention
    ? formatMessageRetentionNotice(messageRetentionDays)
    : "";
  const hasRadio = roomRadioUrl.length > 0;
  const radioIsCurrent = radio.isCurrent(roomRadioUrl);
  const radioPlaying = radioIsCurrent && radio.isPlaying;
  const radioLoading = radioIsCurrent && radio.isLoading;
  const socket = () => socketRef.current;
  const copyLink = () =>
    void navigator.clipboard.writeText(window.location.href);
  const subtleIconClass =
    "h-8 w-8 rounded-full border border-white/10 bg-white/[0.03] p-0 text-[#aebac1] shadow-none hover:bg-white/[0.08] hover:text-white";

  return (
    <div
      className="room-page room-wallpaper space-y-4 max-sm:flex max-sm:h-full max-sm:min-h-0 max-sm:flex-col max-sm:overflow-hidden max-sm:space-y-0"
      style={roomBackgroundStyle}
    >
      {toast && (
        <div
          className={cn(
            "fixed right-4 top-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-2xl",
            toast.tone === "error"
              ? "border-red-400/[0.20] bg-red-500/[0.15] text-red-100"
              : "border-primary/[0.25] bg-primary/[0.14] text-white",
          )}
        >
          {toast.message}
        </div>
      )}

      <div className="room-topbar sticky top-0 z-30 mx-auto flex h-14 w-full max-w-5xl shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-[#111b21] px-2 shadow-2xl max-sm:static max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0 max-sm:shadow-none lg:top-4">
        <Button size="icon" variant="ghost" asChild aria-label="Voltar">
          <Link to="/">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left active:bg-white/[0.06]"
          onClick={() => {
            setRetentionInfoOpen(false);
            setRoomInfoOpen(true);
          }}
        >
          <Avatar
            name={room.name}
            src={resolveMediaUrl(room.bannerUrl)}
            className={cn(
              "h-10 w-10 border border-primary/30 bg-primary/[0.16]",
              isGroup ? "rounded-full" : "rounded-none",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">
              {room.name}
            </span>
            <span className="block truncate text-xs text-[#aebac1]">
              {isGroup ? "Grupo" : "Rave"} - {onlineCount} online - toque para
              info
            </span>
          </span>
        </button>
        {!isGroup && (
          <Button
            size="icon"
            variant={messagesHidden ? "secondary" : "ghost"}
            aria-label={
              messagesHidden ? "Mostrar mensagens" : "Ocultar mensagens"
            }
            title={messagesHidden ? "Mostrar mensagens" : "Ocultar mensagens"}
            aria-pressed={messagesHidden}
            onClick={() => {
              setRetentionInfoOpen(false);
              setMessagesHidden((value) => !value);
            }}
          >
            {messagesHidden ? (
              <MessageCircle className="h-5 w-5" />
            ) : (
              <MessageCircleOff className="h-5 w-5" />
            )}
          </Button>
        )}
        {hasRadio && (
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              subtleIconClass,
              radioPlaying &&
                "border-primary/25 bg-primary/[0.12] text-primary hover:text-primary",
            )}
            aria-label={
              radioPlaying ? "Desativar web radio" : "Ativar web radio"
            }
            aria-pressed={radioPlaying}
            title={
              radio.error ||
              (radioPlaying ? "Parar web radio" : "Ouvir web radio")
            }
            onClick={() =>
              void radio.toggle({ url: roomRadioUrl, title: room.name })
            }
          >
            {radioLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : radioPlaying ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
        )}
        {hasMessageRetention && (
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              subtleIconClass,
              retentionInfoOpen &&
                "border-primary/25 bg-primary/[0.12] text-primary hover:text-primary",
            )}
            aria-label={messageRetentionNotice}
            aria-expanded={retentionInfoOpen}
            title={messageRetentionNotice}
            onClick={() => setRetentionInfoOpen((value) => !value)}
          >
            <Clock3 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {retentionInfoOpen && hasMessageRetention && (
        <div className="mx-auto flex w-full max-w-5xl shrink-0 items-start gap-2.5 rounded-lg border border-white/10 bg-[#182229] px-3 py-2.5 text-left shadow-xl max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0 max-sm:shadow-none">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/[0.16] text-primary">
            <Clock3 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-white">
              Limpeza automatica
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[#aebac1]">
              {messageRetentionNotice}
            </span>
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Fechar aviso"
            onClick={() => setRetentionInfoOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <section
        ref={roomViewportRef}
        className={cn(
          "room-mobile-stack mx-auto max-w-5xl space-y-3 max-sm:flex max-sm:w-full max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-hidden max-sm:space-y-0 max-sm:pt-2",
          messagesAreHidden && "room-mobile-stack--video-only",
          isGroup && "room-mobile-stack--group max-sm:pt-0",
        )}
      >
        {!isGroup && (
          <div
            className={cn(
              "room-mobile-stage room-stage-texture sticky top-16 z-20 rounded-lg border border-primary/[0.16] p-2 shadow-2xl backdrop-blur-xl max-sm:static max-sm:shrink-0 max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0 max-sm:p-1.5 max-sm:shadow-none lg:top-4",
              messagesAreHidden && "max-sm:min-h-0 max-sm:flex-1",
            )}
          >
            <WatchPlayer
              content={activeContent}
              playback={playback}
              canModerate={false}
              onPlayback={emitPlayback}
              className={cn(
                "h-[clamp(220px,42svh,520px)] max-sm:h-[clamp(180px,34svh,300px)]",
                messagesAreHidden && "max-sm:h-full",
              )}
              mediaClassName="h-full aspect-auto"
            />
          </div>
        )}

        {!messagesAreHidden && (
          <ChatPanel
            roomName={room.name}
            onlineCount={onlineCount}
            backgroundUrl={room.backgroundUrl}
            messages={messages}
            currentUserId={me?.user.id ?? ""}
            participant={participant}
            canModerate={false}
            className={cn(
              "room-mobile-chat h-[min(520px,52svh)] min-h-[320px] max-sm:h-auto max-sm:min-h-0 max-sm:flex-1",
              isGroup && "h-[min(760px,calc(100vh-132px))] min-h-[620px]",
            )}
            onOpenRoomInfo={() => setRoomInfoOpen(true)}
            onSend={(payload) => socket()?.emit("chat:message", payload)}
            onPollVote={(pollId, optionId) =>
              socket()?.emit("poll:vote", { pollId, optionId })
            }
            onLike={(messageId) => socket()?.emit("chat:like", { messageId })}
            onDelete={(messageId) =>
              socket()?.emit("chat:delete", { messageId })
            }
            onPin={(messageId, isPinned) =>
              socket()?.emit("chat:pin", { messageId, isPinned })
            }
          />
        )}
      </section>

      {roomInfoOpen && (
        <RoomInfoPanel
          room={room}
          participant={participant}
          participants={participants}
          messagesCount={messageCount}
          messageRanking={messageRanking}
          canModerate={false}
          onClose={() => setRoomInfoOpen(false)}
          onCopyLink={copyLink}
          onPatchParticipant={() => undefined}
        />
      )}
    </div>
  );
}

function formatMessageRetentionNotice(days: number) {
  return `Mensagens com mais de ${days} ${days === 1 ? "dia" : "dias"} sao apagadas automaticamente.`;
}

function RoomEntryGate({
  room,
  messageCount,
  isJoining,
  onJoin,
  backgroundStyle,
  toast,
}: {
  room: Room;
  messageCount: number;
  isJoining: boolean;
  onJoin: () => void;
  backgroundStyle: React.CSSProperties | undefined;
  toast: { message: string; tone: "error" | "info" } | null;
}) {
  const isGroup = room.type === "group";
  const rules = room.rules
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const visibleRules =
    rules.length > 0
      ? rules
      : [
          "Respeite todos os participantes.",
          "Nao envie spam, ofensas ou conteudo proibido.",
          "Use o chat para fortalecer a comunidade.",
        ];

  return (
    <div
      className="room-page room-wallpaper min-h-[calc(100svh-2rem)] px-3 py-4 max-sm:fixed max-sm:inset-x-0 max-sm:top-[var(--room-visual-top,0px)] max-sm:z-40 max-sm:flex max-sm:h-[var(--room-visual-height,100dvh)] max-sm:min-h-0 max-sm:flex-col max-sm:overflow-hidden max-sm:px-0 max-sm:py-0"
      style={backgroundStyle}
    >
      {toast && (
        <div
          className={cn(
            "fixed right-4 top-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-2xl",
            toast.tone === "error"
              ? "border-red-400/[0.20] bg-red-500/[0.15] text-red-100"
              : "border-primary/[0.25] bg-primary/[0.14] text-white",
          )}
        >
          {toast.message}
        </div>
      )}

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 max-sm:h-full max-sm:min-h-0 max-sm:max-w-none max-sm:gap-0">
        <div className="flex items-center justify-between gap-3 max-sm:shrink-0 max-sm:border-b max-sm:border-white/10 max-sm:bg-[#111b21]/95 max-sm:px-3 max-sm:py-3 max-sm:backdrop-blur-xl">
          <Button variant="ghost" asChild>
            <Link to="/">
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <Badge variant={isGroup ? "secondary" : "default"}>
            {isGroup ? "Grupo" : "Rave"}
          </Badge>
        </div>

        <section className="overflow-hidden rounded-xl border border-white/10 bg-[#111b21]/92 shadow-2xl backdrop-blur-xl max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:rounded-none max-sm:border-0 max-sm:shadow-none">
          <div
            className={cn(
              "relative flex min-h-44 items-center justify-center bg-white/[0.04] max-sm:shrink-0",
              isGroup
                ? "min-h-52 max-sm:h-[164px] max-sm:min-h-[164px]"
                : "aspect-[16/7] max-sm:aspect-auto max-sm:h-[156px] max-sm:min-h-[156px]",
            )}
          >
            {isGroup && room.coverUrl && (
              <>
                <img
                  src={resolveMediaUrl(room.coverUrl)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/25" />
              </>
            )}
            {!isGroup && room.bannerUrl && (
              <>
                <img
                  src={resolveMediaUrl(room.bannerUrl)}
                  alt={room.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/20" />
              </>
            )}
            <div className="relative z-10 flex flex-col items-center px-5 py-8 text-center max-sm:px-4 max-sm:py-5">
              <Avatar
                name={room.name}
                src={resolveMediaUrl(room.bannerUrl)}
                className={cn(
                  "h-24 w-24 border-2 border-primary/35 bg-primary/[0.16] text-2xl shadow-2xl max-sm:h-16 max-sm:w-16 max-sm:text-lg",
                  isGroup ? "rounded-full" : "rounded-lg",
                )}
              />
              <h1 className="mt-4 max-w-2xl break-words text-2xl font-black leading-tight text-white max-sm:mt-2 max-sm:text-xl sm:text-4xl">
                {room.name}
              </h1>
              <div className="mt-3 flex flex-wrap justify-center gap-2 max-sm:mt-2 max-sm:gap-1.5">
                <Badge variant="muted">{room.category}</Badge>
                <Badge variant="amber">{messageCount} mensagens</Badge>
                <Badge variant="muted">
                  Criado em{" "}
                  {new Date(room.createdAt).toLocaleDateString("pt-BR")}
                </Badge>
              </div>
            </div>
          </div>

          <div className="thin-scrollbar grid gap-4 p-4 max-sm:min-h-0 max-sm:flex-1 max-sm:overflow-y-auto max-sm:p-3 max-sm:pb-5 sm:p-5 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4 max-sm:p-3">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <p className="text-sm font-black text-white">
                  Sobre este espaco
                </p>
              </div>
              <p className="text-sm leading-relaxed text-[#d1d7db]">
                {room.description}
              </p>
              <p className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.10] px-3 py-2 text-xs leading-relaxed text-primary">
                As mensagens, figurinhas, audios e participantes aparecem depois
                que voce confirmar a entrada.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4 max-sm:p-3">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-sm font-black text-white">
                  Regras da comunidade
                </p>
              </div>
              <div className="space-y-2">
                {visibleRules.map((rule, index) => (
                  <div
                    key={`${rule}-${index}`}
                    className="flex gap-2 rounded-lg bg-black/15 px-3 py-2 text-sm text-[#d1d7db]"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/[0.16] text-[11px] font-black text-primary">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-white/10 bg-[#111b21]/95 p-4 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl max-sm:px-3 max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))] max-sm:pt-3 sm:p-5">
            <Button
              className="h-12 w-full text-base max-sm:h-11"
              onClick={onJoin}
              disabled={isJoining}
            >
              {isJoining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isJoining ? "Entrando..." : "Quero entrar"}
            </Button>
            <p className="mt-3 text-center text-xs leading-relaxed text-[#aebac1] max-sm:mt-2">
              Ao entrar, voce concorda em seguir as regras definidas pelo
              administrador.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function RoomInfoPanel({
  room,
  participant,
  participants,
  messagesCount,
  messageRanking,
  canModerate,
  onClose,
  onCopyLink,
  onPatchParticipant,
}: {
  room: Room;
  participant: Participant | null;
  participants: Participant[];
  messagesCount: number;
  messageRanking: RoomMessageRankingItem[];
  canModerate: boolean;
  onClose: () => void;
  onCopyLink: () => void;
  onPatchParticipant: (
    participantId: string,
    patch: Partial<Participant>,
  ) => void;
}) {
  const onlineCount = participants.filter((item) => item.online).length;
  const isGroup = room.type === "group";
  const roleLabel =
    participant?.role === "administrator"
      ? "Administrador"
      : participant?.role === "moderator"
        ? "Moderador"
        : participant?.role === "viewer"
          ? "Visualizador"
          : "Participante";
  const rules = room.rules
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="ml-auto flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0b141a] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#111b21] px-4">
          <p className="text-sm font-bold text-white">
            {isGroup ? "Info do grupo" : "Info da rave"}
          </p>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="thin-scrollbar flex-1 overflow-y-auto p-4">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
            <div
              className={cn(
                "relative bg-white/[0.05]",
                isGroup
                  ? "flex h-36 items-center justify-center bg-[radial-gradient(circle_at_center,rgba(236,72,153,.18),rgba(255,255,255,.04)_55%,transparent_74%)]"
                  : "h-40",
              )}
            >
              {isGroup ? (
                <>
                  {room.coverUrl ? (
                    <img
                      src={resolveMediaUrl(room.coverUrl)}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-85"
                    />
                  ) : (
                    <div className="absolute inset-0 room-wallpaper bg-[linear-gradient(135deg,rgba(236,72,153,.20),rgba(20,184,166,.12),rgba(255,255,255,.04))]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/25" />
                  {room.bannerUrl ? (
                    <img
                      src={resolveMediaUrl(room.bannerUrl)}
                      alt={room.name}
                      className="relative z-10 h-24 w-24 rounded-full border-2 border-primary/35 object-cover shadow-xl"
                    />
                  ) : (
                    <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary/35 bg-[linear-gradient(135deg,rgba(20,184,166,.20),rgba(236,72,153,.12),rgba(245,158,11,.12))]">
                      <MessageCircle className="h-10 w-10 text-white/70" />
                    </div>
                  )}
                </>
              ) : room.bannerUrl ? (
                <img
                  src={resolveMediaUrl(room.bannerUrl)}
                  alt={room.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(20,184,166,.20),rgba(236,72,153,.12),rgba(245,158,11,.12))]">
                  <MessageCircle className="h-10 w-10 text-white/70" />
                </div>
              )}
            </div>
            <div className="space-y-4 p-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#aebac1]">
                  {isGroup ? "Grupo" : "Rave"}
                </p>
                <h2 className="mt-1 break-words text-2xl font-black leading-tight text-white">
                  {room.name}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{room.category}</Badge>
                <Badge variant={room.isActive ? "default" : "destructive"}>
                  {room.isActive ? "Ativa" : "Encerrada"}
                </Badge>
                <Badge variant={canModerate ? "secondary" : "muted"}>
                  {roleLabel}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-[#d1d7db]">
                {room.description}
              </p>
              {rules.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-black/15 p-3">
                  <p className="text-xs font-semibold uppercase text-[#aebac1]">
                    Regras
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {rules.map((rule, index) => (
                      <p
                        key={`${rule}-${index}`}
                        className="text-sm leading-relaxed text-[#d1d7db]"
                      >
                        {index + 1}. {rule}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <InfoTile label="Online" value={onlineCount} />
            <InfoTile label="Mensagens" value={messagesCount} />
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Trophy className="h-4 w-4 shrink-0 text-[#fbbf24]" />
                <p className="truncate text-xs font-semibold uppercase text-[#aebac1]">
                  Ranking de mensagens
                </p>
              </div>
              <Badge variant="muted">
                {messageRanking.length}{" "}
                {messageRanking.length === 1 ? "usuario" : "usuarios"}
              </Badge>
            </div>

            <div className="mt-3 space-y-2">
              {messageRanking.length > 0 ? (
                messageRanking.map((item, index) => (
                  <div
                    key={item.userId}
                    className="flex min-w-0 items-center gap-3 rounded-lg bg-black/15 px-2.5 py-2"
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black",
                        index === 0
                          ? "bg-[#fbbf24] text-[#1f1300]"
                          : "bg-white/10 text-[#e9edef]",
                      )}
                    >
                      {index + 1}
                    </span>
                    <Avatar
                      src={item.image}
                      name={item.name}
                      className="h-9 w-9 rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {item.name ?? "Usuario"}
                      </p>
                      <p className="text-xs text-[#aebac1]">
                        {item.messageCount}{" "}
                        {item.messageCount === 1 ? "mensagem" : "mensagens"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-lg bg-black/15 px-3 py-3 text-sm text-[#aebac1]">
                  Ainda nao ha mensagens suficientes para montar o ranking.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs font-semibold uppercase text-[#aebac1]">
              Convite
            </p>
            <div className="mt-2 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate rounded-lg bg-black/20 px-3 py-2 text-sm text-[#e9edef]">
                /sala/{room.slug}
              </p>
              <Button
                size="icon"
                variant="outline"
                aria-label="Copiar link"
                onClick={onCopyLink}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" aria-label="Salas" asChild>
                <Link to="/">
                  <Link2 className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <ParticipantsPanel
              participants={participants}
              canModerate={canModerate}
              onPatch={onPatchParticipant}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className="truncate text-base font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-[#aebac1]">{label}</p>
    </div>
  );
}
