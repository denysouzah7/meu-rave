import * as React from "react";
import { Play, X, Pause, ChevronDown, SkipBack, SkipForward, Loader2, Disc3, RotateCcw, RotateCw } from "lucide-react";
import { useMusicPlayer, type PlayerSong } from "@/contexts/MusicPlayerContext";
import { api } from "@/services/api";

function CoverImg({ src, alt, className }: { src: string | null | undefined; alt: string; className: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) return <div className={`${className} flex items-center justify-center bg-white/[0.08]`.trim()}><Disc3 className="h-5 w-5 text-primary/60" /></div>;
  return <img src={String(src)} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} />;
}

export function MusicPlayerBar() {
  const player = useMusicPlayer();
  const [expanded, setExpanded] = React.useState(false);
  const [resolvingIds, setResolvingIds] = React.useState<Set<string>>(new Set());

  // Preload YouTube IDs for songs that don't have one yet
  const resolveYtId = React.useCallback(async (song: PlayerSong) => {
    if (song.youtubeId || player.preloadedIds.current.has(song.id)) return;
    setResolvingIds(prev => new Set([...prev, song.id]));
    try {
      const data = await api<{ videoId: string | null }>(
        `/music/youtube-id?name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist || "")}`
      );
      if (data.videoId) {
        player.setYoutubeId(song.id, data.videoId);
      }
    } catch {}
    setResolvingIds(prev => {
      const next = new Set(prev);
      next.delete(song.id);
      return next;
    });
  }, [player]);

  // When a new current song is set, resolve its ID if needed and play
  React.useEffect(() => {
    if (!player.current) return;
    const song = player.current;
    if (song.youtubeId) return;
    const cached = player.preloadedIds.current.get(song.id);
    if (cached) {
      player.play({ ...song, youtubeId: cached });
      return;
    }
    resolveYtId(song).then(() => {
      const id = player.preloadedIds.current.get(song.id);
      if (id && player.current?.id === song.id) {
        player.play({ ...song, youtubeId: id });
      }
    });
  }, [player.current?.id]);

  // Pre-load IDs for queue
  React.useEffect(() => {
    const queue = player.queue;
    for (const song of queue) {
      if (!song.youtubeId && !player.preloadedIds.current.has(song.id)) {
        resolveYtId(song);
      }
    }
  }, [player.queue]);

  if (!player.current) return null;

  const song = player.current;
  const ytId = song.youtubeId ?? player.preloadedIds.current.get(song.id);
  const isLoading = !ytId || resolvingIds.has(song.id);
  const hasPrev = player.queueIndex > 0;
  const hasNext = player.queueIndex < player.queue.length - 1;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const iframeSrc = ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0&playsinline=1&rel=0` : null;

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#0b141a]">
        <div className="flex items-center justify-between px-4 pt-4">
          <button onClick={() => setExpanded(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-white/60"><ChevronDown className="h-6 w-6" /></button>
          <p className="text-xs font-semibold text-white/60">Tocando agora</p>
          <span className="h-9 w-9" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 sm:px-8">
          <div className="w-full max-w-xs sm:max-w-sm">
            <div className="mb-6 sm:mb-8 aspect-square w-full overflow-hidden rounded-2xl bg-white/[0.06] shadow-2xl">
              {song.thumbnail ? <img src={String(song.thumbnail)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Disc3 className="h-20 w-20 text-muted-foreground/50" /></div>}
            </div>
            <div className="mb-6 min-w-0">
              <p className="truncate text-xl font-bold text-white">{song.name}</p>
              {song.artist && <p className="truncate text-sm text-muted-foreground">{song.artist}</p>}
            </div>
            {isLoading && <div className="flex justify-center mb-6"><Loader2 className="h-6 w-6 animate-spin text-white/60" /></div>}
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <button onClick={player.prev} disabled={!hasPrev} className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-white/60 disabled:text-white/20"><SkipBack className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" /></button>
              <span className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-white text-black shadow-lg">
                {player.isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </span>
              <button onClick={player.next} disabled={!hasNext} className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-white/60 disabled:text-white/20"><SkipForward className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" /></button>
            </div>
          </div>
        </div>
        {iframeSrc && <iframe src={iframeSrc} className="absolute" style={{ left: -9999, top: -9999, width: 1, height: 1 }} allow="autoplay" title="player" />}
      </div>
    );
  }

  return (
    <div className="fixed bottom-14 sm:bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0b141a]/95 backdrop-blur-xl lg:bottom-0">
      {iframeSrc && player.isPlaying && <iframe src={iframeSrc} className="sr-only" allow="autoplay" title="player" />}
      <div className="mx-auto flex max-w-[1500px] items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-2.5" onClick={() => setExpanded(true)} style={{ cursor: "pointer" }}>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {song.thumbnail && <CoverImg src={song.thumbnail} alt="" className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded object-cover" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{song.name}</p>
            {song.artist && <p className="truncate text-xs text-muted-foreground">{song.artist}</p>}
          </div>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={player.prev} disabled={!hasPrev} className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 disabled:text-white/20"><SkipBack className="h-4 w-4" fill="currentColor" /></button>
          <button onClick={player.next} disabled={!hasNext} className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 disabled:text-white/20"><SkipForward className="h-4 w-4" fill="currentColor" /></button>
          <button onClick={player.stop} className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-white/40"><X className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
