import * as React from "react";
import { Search, Play, X, Pause, ChevronLeft, SkipBack, SkipForward, Loader2 } from "lucide-react";
import {
  useMusicHome,
  useMusicSearch,
  useMusicPlaylist,
  type MusicItem,
} from "@/hooks/useMusic";

/* ── YouTube IFrame API loader ── */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytReady = false;
let ytCallbacks: (() => void)[] = [];

function loadYT(): Promise<void> {
  if (ytReady && window.YT?.Player) return Promise.resolve();
  return new Promise<void>((resolve) => {
    ytCallbacks.push(resolve);
    if (window.YT?.Player) { resolve(); return; }
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    window.onYouTubeIframeAPIReady = () => {
      ytReady = true;
      ytCallbacks.forEach((cb) => cb());
      ytCallbacks = [];
    };
  });
}

/* ── Page ── */
export function MusicPage() {
  const { data: homeData, isLoading } = useMusicHome();
  const [query, setQuery] = React.useState("");
  const [showSearch, setShowSearch] = React.useState(false);
  const [currentVideo, setCurrentVideo] = React.useState<MusicItem | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isLoadingSong, setIsLoadingSong] = React.useState(false);
  const [loadingPlaylistId, setLoadingPlaylistId] = React.useState<string | null>(null);
  const [queue, setQueue] = React.useState<MusicItem[]>([]);
  const [queueIndex, setQueueIndex] = React.useState(0);

  const search = useMusicSearch(query);
  const [activePlaylistId, setActivePlaylistId] = React.useState<string | null>(null);
  const playlistData = useMusicPlaylist(activePlaylistId ?? "");

  const playerRef = React.useRef<any>(null);
  const playerDivRef = React.useRef<HTMLDivElement | null>(null);
  const pendingVideoIdRef = React.useRef<string | null>(null);
  const queueRef = React.useRef<{ queue: MusicItem[]; index: number }>({ queue: [], index: 0 });

  // Init player once
  React.useEffect(() => {
    loadYT().then(() => {
      if (playerRef.current || !playerDivRef.current) return;
      playerRef.current = new window.YT.Player(playerDivRef.current, {
        height: "1",
        width: "1",
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1 },
        events: {
          onReady: () => {
            if (pendingVideoIdRef.current) {
              playerRef.current.loadVideoById(pendingVideoIdRef.current);
              pendingVideoIdRef.current = null;
            }
          },
          onStateChange: (e: any) => {
            const YT = window.YT;
            if (!YT) return;
            if (e.data === YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setIsLoadingSong(false);
            } else if (e.data === YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (e.data === YT.PlayerState.ENDED) {
              handleEnded();
            } else if (e.data === YT.PlayerState.BUFFERING) {
              setIsLoadingSong(true);
            }
          },
          onError: () => {
            setIsLoadingSong(false);
            handleEnded();
          },
        },
      });
    });
  }, []);

  const handleEnded = React.useCallback(() => {
    const { queue: q, index } = queueRef.current;
    if (index < q.length - 1) {
      const next = q[index + 1];
      if (next?.videoId) {
        setCurrentVideo(next);
        setQueueIndex(index + 1);
        queueRef.current = { queue: q, index: index + 1 };
        if (playerRef.current?.loadVideoById) {
          playerRef.current.loadVideoById(next.videoId);
        } else {
          pendingVideoIdRef.current = next.videoId;
        }
      }
    } else {
      setIsPlaying(false);
    }
  }, []);

  const loadVideo = (videoId: string) => {
    setIsLoadingSong(true);
    if (playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById(videoId);
    } else {
      pendingVideoIdRef.current = videoId;
    }
  };

  /* Play a single song */
  const playSong = (song: MusicItem, list?: MusicItem[]) => {
    if (!song.videoId) return;
    const q = list ?? [song];
    const idx = q.findIndex((s) => s.videoId === song.videoId);
    setQueue(q);
    setQueueIndex(idx >= 0 ? idx : 0);
    queueRef.current = { queue: q, index: idx >= 0 ? idx : 0 };
    setCurrentVideo(song);
    setIsPlaying(true);
    loadVideo(song.videoId);
  };

  /* Play a playlist: fetch songs then play */
  const playPlaylist = (playlistId: string) => {
    setLoadingPlaylistId(playlistId);
    setActivePlaylistId(playlistId);
  };

  React.useEffect(() => {
    if (playlistData.data?.songs?.length && loadingPlaylistId) {
      const songs = playlistData.data.songs;
      setQueue(songs);
      setQueueIndex(0);
      queueRef.current = { queue: songs, index: 0 };
      const first = songs.find((s) => s.videoId);
      if (first?.videoId) {
        setCurrentVideo(first);
        setIsPlaying(true);
        loadVideo(first.videoId);
      }
      setLoadingPlaylistId(null);
    }
  }, [playlistData.data, loadingPlaylistId]);

  /* Controls */
  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  };

  const playNext = () => {
    const { queue: q, index } = queueRef.current;
    if (index < q.length - 1) {
      const next = q[index + 1];
      if (!next?.videoId) return;
      setCurrentVideo(next);
      setQueueIndex(index + 1);
      queueRef.current = { queue: q, index: index + 1 };
      loadVideo(next.videoId);
    }
  };

  const playPrev = () => {
    const { queue: q, index } = queueRef.current;
    if (index > 0) {
      const prev = q[index - 1];
      if (!prev?.videoId) return;
      setCurrentVideo(prev);
      setQueueIndex(index - 1);
      queueRef.current = { queue: q, index: index - 1 };
      loadVideo(prev.videoId);
    }
  };

  const onClose = () => {
    playerRef.current?.stopVideo();
    setCurrentVideo(null);
    setIsPlaying(false);
    setQueue([]);
    setQueueIndex(0);
    queueRef.current = { queue: [], index: 0 };
  };

  var hasPrev = queueIndex > 0;
  var hasNext = queueIndex < queue.length - 1;

  return (
    <div className="space-y-6 pb-24">
      {/* Player div (hidden) */}
      <div ref={playerDivRef} style={{ position: "absolute", left: -9999, top: -9999, width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />

      {/* Header */}
      <div className="flex items-center gap-4">
        {showSearch ? (
          <>
            <button
              type="button"
              onClick={() => { setShowSearch(false); setQuery(""); }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex flex-1 items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar músicas, artistas, playlists..."
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white">Música</h1>
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white hover:bg-white/10"
            >
              <Search className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Search results */}
      {showSearch && query ? (
        <div className="space-y-2">
          {search.isLoading && <p className="text-sm text-muted-foreground">Buscando...</p>}
          {search.data?.results?.map((item, i) => (
            <MusicRow
              key={item.videoId ?? item.playlistId ?? i}
              item={item}
              onPlay={() => {
                if (item.videoId) playSong(item);
                else if (item.playlistId) playPlaylist(item.playlistId);
              }}
            />
          ))}
          {search.data?.results?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum resultado.</p>
          )}
        </div>
      ) : (
        <>
          {/* Home sections */}
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {homeData?.sections?.map((section, i) => (
            <div key={i} className="space-y-3">
              <h2 className="text-lg font-bold text-white">{section.title}</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 thin-scrollbar">
                {section.contents.map((item, j) => (
                  <MusicCard
                    key={item.playlistId ?? item.videoId ?? j}
                    item={item}
                    loading={loadingPlaylistId === item.playlistId}
                    onClick={() => {
                      if (item.videoId) {
                        playSong(item, section.contents.filter((c) => c.videoId));
                      } else if (item.playlistId) {
                        playPlaylist(item.playlistId);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Mini player */}
      {currentVideo && (
        <MiniPlayer
          video={currentVideo}
          isPlaying={isPlaying}
          isLoading={isLoadingSong}
          onTogglePlay={togglePlay}
          onNext={playNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={playPrev}
          onClose={onClose}
        />
      )}
    </div>
  );
}

/* ── Components ── */

function MusicCard({
  item,
  onClick,
  loading,
}: {
  item: MusicItem;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="group flex w-40 shrink-0 flex-col gap-2 text-left disabled:opacity-50"
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-white/[0.06]">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Play className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
          {loading ? <Loader2 className="h-6 w-6 animate-spin text-white" /> : <Play className="h-8 w-8 text-white" fill="white" />}
        </div>
      </div>
      <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{item.name}</p>
      {item.artist && <p className="line-clamp-1 text-xs text-muted-foreground">{item.artist}</p>}
    </button>
  );
}

function MusicRow({ item, onPlay }: { item: MusicItem; onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      disabled={!item.videoId && !item.playlistId}
      className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/[0.06] disabled:opacity-50"
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-white/[0.06]">
        {item.thumbnail && <img src={item.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{item.name}</p>
        {item.artist && <p className="truncate text-xs text-muted-foreground">{item.artist}</p>}
      </div>
      {item.duration && (
        <span className="shrink-0 text-xs text-muted-foreground">{Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, "0")}</span>
      )}
      {item.type === "playlist" && <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-muted-foreground">Playlist</span>}
    </button>
  );
}

function MiniPlayer({
  video,
  isPlaying,
  isLoading,
  onTogglePlay,
  onNext,
  onPrev,
  onClose,
  hasPrev,
  hasNext,
}: {
  video: MusicItem;
  isPlaying: boolean;
  isLoading: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  React.useEffect(() => {
    document.body.style.paddingBottom = "80px";
    return () => { document.body.style.paddingBottom = ""; };
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0b141a]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2.5">
        {/* Capa + info */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {video.thumbnail && <img src={video.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{video.name}</p>
            {video.artist && <p className="truncate text-xs text-muted-foreground">{video.artist}</p>}
          </div>
        </div>

        {/* Loading indicator */}
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-1">
          {hasPrev && (
            <button type="button" onClick={onPrev} className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:text-white">
              <SkipBack className="h-4 w-4" fill="currentColor" />
            </button>
          )}
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition hover:scale-105"
          >
            {isPlaying ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
          </button>
          {hasNext && (
            <button type="button" onClick={onNext} className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:text-white">
              <SkipForward className="h-4 w-4" fill="currentColor" />
            </button>
          )}
          <button type="button" onClick={onClose} className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}