import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { AlertTriangle, ChevronLeft, Copy, Link2, MessageCircle, MessageCircleOff, X } from "lucide-react";
import type { ChatMessage, Participant, PlaybackState, Room, RoomContent, RoomPayload } from "@/services/types";
import { API_URL, resolveMediaUrl } from "@/services/api";
import { useMe, useRoom } from "@/hooks/useApi";
import { WatchPlayer } from "@/components/room/WatchPlayer";
import { ChatPanel } from "@/components/room/ChatPanel";
import { ParticipantsPanel } from "@/components/room/ParticipantsPanel";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export function RoomPage() {
  const { slug = "" } = useParams();
  const { data: me } = useMe();
  const initial = useRoom(slug);
  const [room, setRoom] = React.useState<Room | null>(null);
  const [participant, setParticipant] = React.useState<Participant | null>(null);
  const [contents, setContents] = React.useState<RoomContent[]>([]);
  const [playback, setPlayback] = React.useState<PlaybackState | null>(null);
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [toast, setToast] = React.useState("");
  const [roomInfoOpen, setRoomInfoOpen] = React.useState(false);
  const [messagesHidden, setMessagesHidden] = React.useState(false);
  const roomViewportRef = React.useRef<HTMLElement | null>(null);
  const socketRef = React.useRef<Socket | null>(null);

  const applyPayload = React.useCallback((payload: RoomPayload) => {
    setRoom(payload.room);
    setParticipant(payload.participant);
    setContents(payload.contents);
    setPlayback(payload.playback);
    setParticipants(payload.participants);
    setMessages(payload.messages);
  }, []);

  React.useEffect(() => {
    if (initial.data) {
      applyPayload(initial.data);
    }
  }, [initial.data, applyPayload]);

  React.useEffect(() => {
    const target = roomViewportRef.current;
    if (!target) return;

    const syncViewport = () => {
      const viewport = window.visualViewport;
      target.style.setProperty("--room-visual-height", `${Math.round(viewport?.height ?? window.innerHeight)}px`);
      target.style.setProperty("--room-visual-top", `${Math.round(viewport?.offsetTop ?? 0)}px`);
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
    if (!slug) return;

    const socket = io(API_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("room:join", { slug }));
    socket.on("room:state", (payload: RoomPayload) => applyPayload(payload));
    socket.on("participants:update", (payload: { participants: Participant[] }) => setParticipants(payload.participants));
    socket.on("player:update", (payload: { playback: PlaybackState }) => setPlayback(payload.playback));
    socket.on("chat:message", (payload: { message: ChatMessage }) =>
      setMessages((value) => [...value.filter((message) => message.id !== payload.message.id), payload.message])
    );
    socket.on("chat:delete", (payload: { messageId: string }) =>
      setMessages((value) => value.filter((message) => message.id !== payload.messageId))
    );
    socket.on("chat:likes", (payload: { messageId: string; likes: number }) =>
      setMessages((value) =>
        value.map((message) => (message.id === payload.messageId ? { ...message, likes: payload.likes } : message))
      )
    );
    socket.on("chat:pin", (payload: { messageId: string; isPinned: boolean }) =>
      setMessages((value) =>
        value.map((message) =>
          message.id === payload.messageId ? { ...message, isPinned: payload.isPinned } : message
        )
      )
    );
    socket.on("error:toast", (payload: { message: string }) => {
      setToast(payload.message);
      setTimeout(() => setToast(""), 2500);
    });

    return () => {
      socket.emit("room:leave");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [slug, applyPayload]);

  const emitPlayback = React.useCallback((patch: { contentId?: string | null; isPlaying: boolean; positionSeconds: number }) => {
    socketRef.current?.emit("player:update", patch);
  }, []);

  if (initial.isLoading && !room) {
    return <div className="h-80 animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />;
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

  const activeContent =
    contents.find((content) => content.id === playback?.contentId) ?? contents.find((content) => content.isActive) ?? null;
  const onlineCount = participants.filter((item) => item.online).length;
  const socket = () => socketRef.current;
  const copyLink = () => void navigator.clipboard.writeText(window.location.href);

  return (
    <div className="room-page space-y-4 max-sm:flex max-sm:h-full max-sm:min-h-0 max-sm:flex-col max-sm:overflow-hidden max-sm:bg-[#071014] max-sm:space-y-0">
      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-lg border border-red-400/[0.20] bg-red-500/[0.15] px-4 py-3 text-sm text-red-100 shadow-2xl">
          {toast}
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
          onClick={() => setRoomInfoOpen(true)}
        >
          <Avatar
            name={room.name}
            src={resolveMediaUrl(room.bannerUrl)}
            className="h-10 w-10 rounded-full border border-primary/30 bg-primary/[0.16]"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">{room.name}</span>
            <span className="block truncate text-xs text-[#aebac1]">
              {onlineCount} online - toque para info
            </span>
          </span>
        </button>
        <Button
          size="icon"
          variant={messagesHidden ? "secondary" : "ghost"}
          aria-label={messagesHidden ? "Mostrar mensagens" : "Ocultar mensagens"}
          title={messagesHidden ? "Mostrar mensagens" : "Ocultar mensagens"}
          aria-pressed={messagesHidden}
          onClick={() => setMessagesHidden((value) => !value)}
        >
          {messagesHidden ? <MessageCircle className="h-5 w-5" /> : <MessageCircleOff className="h-5 w-5" />}
        </Button>
        <Button size="icon" variant="ghost" aria-label="Copiar link" onClick={copyLink}>
          <Link2 className="h-5 w-5" />
        </Button>
      </div>

      <section
        ref={roomViewportRef}
        className={cn(
          "room-mobile-stack mx-auto max-w-5xl space-y-3 max-sm:flex max-sm:w-full max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-hidden max-sm:space-y-0 max-sm:pt-2",
          messagesHidden && "room-mobile-stack--video-only"
        )}
      >
        <div
          className={cn(
            "room-mobile-stage sticky top-16 z-20 rounded-lg border border-primary/[0.16] bg-background/95 p-2 shadow-2xl backdrop-blur-xl max-sm:static max-sm:shrink-0 max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0 max-sm:bg-[#071014] max-sm:p-1.5 max-sm:shadow-none lg:top-4",
            messagesHidden && "max-sm:min-h-0 max-sm:flex-1"
          )}
        >
          <WatchPlayer
            content={activeContent}
            playback={playback}
            canModerate={false}
            onPlayback={emitPlayback}
            className={cn(
              "h-[clamp(220px,42svh,520px)] max-sm:h-[clamp(180px,34svh,300px)]",
              messagesHidden && "max-sm:h-full"
            )}
            mediaClassName="h-full aspect-auto"
          />
        </div>

        {!messagesHidden && (
          <ChatPanel
            roomName={room.name}
            onlineCount={onlineCount}
            messages={messages}
            currentUserId={me?.user.id ?? ""}
            participant={participant}
            canModerate={false}
            className="room-mobile-chat h-[min(520px,52svh)] min-h-[320px] max-sm:h-auto max-sm:min-h-0 max-sm:flex-1"
            onOpenRoomInfo={() => setRoomInfoOpen(true)}
            onSend={(payload) => socket()?.emit("chat:message", payload)}
            onLike={(messageId) => socket()?.emit("chat:like", { messageId })}
            onDelete={(messageId) => socket()?.emit("chat:delete", { messageId })}
            onPin={(messageId, isPinned) => socket()?.emit("chat:pin", { messageId, isPinned })}
          />
        )}
      </section>

      {roomInfoOpen && (
        <RoomInfoPanel
          room={room}
          participant={participant}
          participants={participants}
          messagesCount={messages.length}
          canModerate={false}
          onClose={() => setRoomInfoOpen(false)}
          onCopyLink={copyLink}
          onPatchParticipant={() => undefined}
        />
      )}
    </div>
  );
}

function RoomInfoPanel({
  room,
  participant,
  participants,
  messagesCount,
  canModerate,
  onClose,
  onCopyLink,
  onPatchParticipant
}: {
  room: Room;
  participant: Participant | null;
  participants: Participant[];
  messagesCount: number;
  canModerate: boolean;
  onClose: () => void;
  onCopyLink: () => void;
  onPatchParticipant: (participantId: string, patch: Partial<Participant>) => void;
}) {
  const onlineCount = participants.filter((item) => item.online).length;

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
          <p className="text-sm font-bold text-white">Info da sala</p>
          <Button size="icon" variant="ghost" aria-label="Fechar" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="thin-scrollbar flex-1 overflow-y-auto p-4">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
            <div className="relative h-36 bg-white/[0.05]">
              {room.bannerUrl ? (
                <img src={resolveMediaUrl(room.bannerUrl)} alt={room.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-[linear-gradient(135deg,rgba(20,184,166,.24),rgba(236,72,153,.14),rgba(245,158,11,.16))]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b141a] to-transparent" />
            </div>
            <div className="p-4">
              <div className="-mt-12 mb-3 flex justify-center">
                <Avatar name={room.name} className="h-20 w-20 rounded-full border-4 border-[#0b141a] bg-primary/[0.16] text-xl" />
              </div>
              <h2 className="text-center text-xl font-black text-white">{room.name}</h2>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Badge>{room.category}</Badge>
                <Badge variant={room.isActive ? "default" : "destructive"}>
                  {room.isActive ? "Ativa" : "Encerrada"}
                </Badge>
                {canModerate && <Badge variant="secondary">Moderacao</Badge>}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[#d1d7db]">{room.description}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <InfoTile label="Online" value={onlineCount} />
            <InfoTile label="Mensagens" value={messagesCount} />
            <InfoTile label="Permissao" value={canModerate ? "Admin" : participant?.role ?? "Participante"} />
            <InfoTile label="Criador" value={room.creatorName ?? "Criador"} />
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs font-semibold uppercase text-[#aebac1]">Link</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate rounded-lg bg-black/20 px-3 py-2 text-sm text-[#e9edef]">
                /sala/{room.slug}
              </p>
              <Button size="icon" variant="outline" aria-label="Copiar link" onClick={onCopyLink}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" aria-label="Salas" asChild>
                <Link to="/">
                  <Link2 className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-3">
              <Avatar src={resolveMediaUrl(room.creatorImage)} name={room.creatorName} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{room.creatorName ?? "Criador"}</p>
                <p className="text-xs text-[#aebac1]">Criador da sala</p>
              </div>
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
