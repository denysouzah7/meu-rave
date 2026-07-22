import * as React from "react";
import { Maximize2, Minimize2, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, Tv } from "lucide-react";
import type { PlaybackState, RoomContent } from "@/services/types";
import { resolveMediaUrl } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, playbackPosition } from "@/lib/utils";

type Props = {
  content: RoomContent | null;
  playback: PlaybackState | null;
  canModerate: boolean;
  onPlayback: (patch: { contentId?: string | null; isPlaying: boolean; positionSeconds: number }) => void;
  className?: string;
  mediaClassName?: string;
};

function youtubeEmbed(url: string, start: number, playing: boolean) {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, "");
  const id = host === "youtu.be" ? parsed.pathname.slice(1) : parsed.searchParams.get("v");
  if (!id) return url;
  return `https://www.youtube.com/embed/${id}?start=${Math.floor(start)}&autoplay=${playing ? 1 : 0}&rel=0&modestbranding=1&enablejsapi=1`;
}

function WatchPlayerComponent({ content, playback, canModerate, onPlayback, className, mediaClassName }: Props) {
  const playerRef = React.useRef<HTMLDivElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const syncedPosition = React.useMemo(
    () => (playback ? playbackPosition(playback.positionSeconds, playback.updatedAt, playback.isPlaying) : 0),
    [playback?.isPlaying, playback?.positionSeconds, playback?.updatedAt]
  );
  const [displayPosition, setDisplayPosition] = React.useState(syncedPosition);
  const youtubeSrc = React.useMemo(() => {
    if (!content || !playback || content.sourceType !== "youtube") return "";
    return youtubeEmbed(content.sourceUrl, syncedPosition, playback.isPlaying);
  }, [content?.id, content?.sourceType, content?.sourceUrl, playback?.isPlaying, playback?.updatedAt, syncedPosition]);

  React.useEffect(() => {
    const updateFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === playerRef.current);
    };

    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  React.useEffect(() => {
    setDisplayPosition(syncedPosition);

    if (!playback?.isPlaying) {
      return;
    }

    const interval = window.setInterval(() => {
      setDisplayPosition(playbackPosition(playback.positionSeconds, playback.updatedAt, playback.isPlaying));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [playback?.isPlaying, playback?.positionSeconds, playback?.updatedAt, syncedPosition]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !playback || !content || content.sourceType === "youtube") return;

    const expected = playbackPosition(playback.positionSeconds, playback.updatedAt, playback.isPlaying);
    if (Math.abs(video.currentTime - expected) > 1.2) {
      video.currentTime = expected;
    }
    if (playback.isPlaying) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [content?.id, content?.sourceType, playback?.updatedAt, playback?.isPlaying, playback?.positionSeconds]);

  if (!content || !playback) {
    return (
      <Card className={cn("grid aspect-video place-items-center overflow-hidden bg-black/60", className)}>
        <EmptyState
          className="m-4 w-[calc(100%-2rem)]"
          icon={<Tv className="h-5 w-5" />}
          title="Nenhum conteúdo ativo"
          description="Administradores podem adicionar YouTube, link direto ou upload de vídeo."
        />
      </Card>
    );
  }

  const localPosition = () => videoRef.current?.currentTime ?? displayPosition;
  const send = (isPlaying: boolean, delta = 0) =>
    onPlayback({
      contentId: content.id,
      isPlaying,
      positionSeconds: Math.max(0, localPosition() + delta)
    });
  const toggleFullscreen = async () => {
    const target = playerRef.current;
    if (!target) return;

    try {
      if (document.fullscreenElement === target) {
        await document.exitFullscreen();
        return;
      }

      await target.requestFullscreen();
    } catch {
      setIsFullscreen(false);
    }
  };

  return (
    <Card
      ref={playerRef}
      className={cn(
        "overflow-hidden bg-black",
        isFullscreen && "h-screen w-screen rounded-none border-0",
        className
      )}
    >
      <div className={cn("relative aspect-video", mediaClassName, isFullscreen && "h-full w-full aspect-auto")}>
        {content.sourceType === "youtube" ? (
          <iframe
            key={`${content.id}-${playback.updatedAt}`}
            src={youtubeSrc}
            title={content.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <video ref={videoRef} src={resolveMediaUrl(content.sourceUrl)} className="h-full w-full bg-black object-contain" playsInline />
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <Badge variant={content.sourceType === "youtube" ? "secondary" : "default"}>{content.sourceType}</Badge>
          <div className="pointer-events-auto flex items-center gap-2">
            <Badge variant={playback.isPlaying ? "default" : "muted"}>{playback.isPlaying ? "Ao vivo" : "Pausado"}</Badge>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              className="h-8 w-8 border-white/20 bg-black/35 text-white backdrop-blur hover:bg-white/15"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
          <div className="mb-3">
            <p className="truncate text-sm font-bold">{content.title}</p>
            <p className="text-xs text-muted-foreground">
              {Math.floor(displayPosition)}s sincronizados para todos os participantes
            </p>
          </div>

          {canModerate && (
            <div className="flex flex-wrap gap-2">
              <Button size="icon" variant="outline" aria-label="Retroceder 15 segundos" onClick={() => send(playback.isPlaying, -15)}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" aria-label="Retroceder 5 segundos" onClick={() => send(playback.isPlaying, -5)}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button size="icon" aria-label={playback.isPlaying ? "Pausar" : "Reproduzir"} onClick={() => send(!playback.isPlaying)}>
                {playback.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="outline" aria-label="Avançar 5 segundos" onClick={() => send(playback.isPlaying, 5)}>
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" aria-label="Avançar 15 segundos" onClick={() => send(playback.isPlaying, 15)}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export const WatchPlayer = React.memo(WatchPlayerComponent);
