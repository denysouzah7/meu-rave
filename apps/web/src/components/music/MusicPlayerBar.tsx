import * as React from "react";
import { Play, X, Pause, ChevronDown, SkipBack, SkipForward, Loader2, Disc3, RotateCcw, RotateCw } from "lucide-react";
import { useMusicPlayer, type PlayerSong } from "@/contexts/MusicPlayerContext";
import { api, API_URL } from "@/services/api";
import { useMusicApiUrl } from "@/hooks/useMusic";

function CoverImg({ src, alt, className }: { src: string | null | undefined; alt: string; className: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) return <div className={className + " flex items-center justify-center bg-white/[0.08]"}><Disc3 className="h-5 w-5 text-primary/60" /></div>;
  return <img src={String(src)} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} />;
}

export function MusicPlayerBar() {
  const player = useMusicPlayer();
  const musicApiUrl = useMusicApiUrl() || API_URL;
  const [expanded, setExpanded] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [audioPosition, setAudioPosition] = React.useState(0);
  const [audioDuration, setAudioDuration] = React.useState(0);
  const [audioLoading, setAudioLoading] = React.useState(false);

  React.useEffect(() => {
    if (!player.current) { audioRef.current?.pause(); return; }
    const song = player.current;
    const audio = audioRef.current;
    if (!audio) return;
    setAudioLoading(true);
    const resolveAndPlay = async () => {
      try {
        const data = await api<{ videoId: string | null }>(
          `/music/youtube-id?name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist || "")}`
        );
        if (data.videoId) {
          audio.src = `${musicApiUrl}/api/music/stream/${data.videoId}`;
          audio.play().then(() => {
            setAudioLoading(false);
            setAudioDuration(audio.duration || 0);
          }).catch(() => { setAudioLoading(false); });
        } else {
          setAudioLoading(false);
        }
      } catch { setAudioLoading(false); }
    };
    resolveAndPlay();
  }, [player.current?.id]);

  React.useEffect(() => {
    const iv = setInterval(() => {
      const a = audioRef.current;
      if (!a) return;
      setAudioPosition(a.currentTime || 0);
      setAudioDuration(a.duration || audioDuration);
    }, 500);
    return () => clearInterval(iv);
  }, [audioDuration]);

  if (!player.current) return null;

  const song = player.current;
  const isLoading = audioLoading;
  const hasPrev = player.queueIndex > 0;
  const hasNext = player.queueIndex < player.queue.length - 1;
  const pct = audioDuration > 0 ? (audioPosition / audioDuration) * 100 : 0;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const togglePlay = () => { const a = audioRef.current; if (!a) return; if (a.paused) a.play().catch(() => {}); else a.pause(); };
  const seekForward = () => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 15, audioRef.current.duration || 0); };
  const seekBackward = () => { if (audioRef.current) audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 15, 0); };

  return (
    <>
      <audio ref={audioRef} preload="none" playsInline style={{ display: "none" }} onEnded={() => player.next()} />
      {expanded ? (
        <ExpandedPlayer song={song} pct={pct} formatTime={formatTime} audioPosition={audioPosition} audioDuration={audioDuration} isLoading={isLoading} hasPrev={hasPrev} hasNext={hasNext} player={player} togglePlay={togglePlay} seekForward={seekForward} seekBackward={seekBackward} onClose={() => setExpanded(false)} />
      ) : (
        <MiniPlayer song={song} pct={pct} formatTime={formatTime} audioPosition={audioPosition} audioDuration={audioDuration} isLoading={isLoading} hasPrev={hasPrev} hasNext={hasNext} player={player} togglePlay={togglePlay} onExpand={() => setExpanded(true)} setExpanded={setExpanded} />
      )}
    </>
  );
}

function ExpandedPlayer({ song, pct, formatTime, audioPosition, audioDuration, isLoading, hasPrev, hasNext, player, togglePlay, seekForward, seekBackward, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b141a]">
      <div className="flex items-center justify-between px-4 pt-4">
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-white/60"><ChevronDown className="h-6 w-6" /></button>
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
          <div className="mb-2 h-1.5 w-full cursor-pointer rounded-full bg-white/10" onClick={(e: any) => {
            const r = e.currentTarget.getBoundingClientRect();
            const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
            const a = document.querySelector("audio[style*='display: none']") as HTMLAudioElement;
            if (a?.duration) a.currentTime = p * a.duration;
          }}><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
          <div className="mb-8 flex justify-between text-xs text-muted-foreground"><span>{formatTime(audioPosition)}</span><span>{formatTime(audioDuration)}</span></div>
          {isLoading && <div className="flex justify-center mb-6"><Loader2 className="h-6 w-6 animate-spin text-white/60" /></div>}
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <button onClick={seekBackward} className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-white/50 hover:text-white"><RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" /></button>
            {hasPrev && <button onClick={player.prev} className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-white/60 hover:text-white"><SkipBack className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" /></button>}
            <button onClick={togglePlay} className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:scale-105">{player.isPlaying ? <Pause className="h-6 w-6 sm:h-7 sm:w-7" /> : <Play className="h-6 w-6 sm:h-7 sm:w-7" />}</button>
            {hasNext && <button onClick={player.next} className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-white/60 hover:text-white"><SkipForward className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" /></button>}
            <button onClick={seekForward} className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-white/50 hover:text-white"><RotateCw className="h-4 w-4 sm:h-5 sm:w-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniPlayer({ song, pct, formatTime, audioPosition, audioDuration, isLoading, hasPrev, hasNext, player, togglePlay, onExpand }: any) {
  return (
    <div className="fixed bottom-14 sm:bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0b141a]/95 backdrop-blur-xl lg:bottom-0">
      <div className="h-1 w-full cursor-pointer bg-white/10" onClick={(e: any) => {
        const r = e.currentTarget.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        const a = document.querySelector("audio[style*='display: none']") as HTMLAudioElement;
        if (a?.duration) a.currentTime = p * a.duration;
      }}><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
      <div className="mx-auto flex max-w-[1500px] items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-2.5" onClick={onExpand} style={{ cursor: "pointer" }}>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {song.thumbnail && <CoverImg src={song.thumbnail} alt="" className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded object-cover" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{song.name}</p>
            {song.artist && <p className="truncate text-xs text-muted-foreground">{song.artist}</p>}
            <p className="text-[10px] text-muted-foreground">{formatTime(audioPosition)} / {formatTime(audioDuration)}</p>
          </div>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1" onClick={e => e.stopPropagation()}>
          {hasPrev && <button onClick={player.prev} className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:text-white"><SkipBack className="h-4 w-4" fill="currentColor" /></button>}
          <button onClick={togglePlay} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition hover:scale-105">{player.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}</button>
          {hasNext && <button onClick={player.next} className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:text-white"><SkipForward className="h-4 w-4" fill="currentColor" /></button>}
          <button onClick={player.stop} className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
