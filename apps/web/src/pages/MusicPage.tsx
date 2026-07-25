import * as React from "react";
import { Search, Play, X, Pause, ChevronLeft } from "lucide-react";
import {
  useMusicHome,
  useMusicSearch,
  type MusicItem,
} from "@/hooks/useMusic";
import { resolveMediaUrl } from "@/services/api";

export function MusicPage() {
  const { data: homeData, isLoading } = useMusicHome();
  const [query, setQuery] = React.useState("");
  const [showSearch, setShowSearch] = React.useState(false);
  const [currentVideo, setCurrentVideo] = React.useState<MusicItem | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playlist, setPlaylist] = React.useState<MusicItem[]>([]);
  const [playlistIndex, setPlaylistIndex] = React.useState(0);

  const search = useMusicSearch(query);

  const playSong = (song: MusicItem, list?: MusicItem[]) => {
    setCurrentVideo(song);
    setIsPlaying(true);
    if (list) {
      setPlaylist(list);
      setPlaylistIndex(list.findIndex((s) => s.videoId === song.videoId));
    } else {
      setPlaylist([song]);
      setPlaylistIndex(0);
    }
  };

  const playNext = () => {
    if (playlistIndex < playlist.length - 1) {
      const next = playlist[playlistIndex + 1];
      if (!next) return;
      setCurrentVideo(next);
      setPlaylistIndex(playlistIndex + 1);
      setIsPlaying(true);
    }
  };

  const playPrev = () => {
    if (playlistIndex > 0) {
      const prev = playlist[playlistIndex - 1];
      if (!prev) return;
      setCurrentVideo(prev);
      setPlaylistIndex(playlistIndex - 1);
      setIsPlaying(true);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header com busca */}
      <div className="flex items-center gap-4">
        {showSearch ? (
          <>
            <button
              onClick={() => { setShowSearch(false); setQuery(""); }}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
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
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button onClick={() => setQuery("")}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black">Música</h1>
            <button
              onClick={() => setShowSearch(true)}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/10"
            >
              <Search className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Resultados da busca */}
      {showSearch && query ? (
        <div className="space-y-2">
          {search.isLoading && <p className="text-sm text-muted-foreground">Buscando...</p>}
          {search.data?.results?.map((item, i) => (
            <MusicRow
              key={item.videoId ?? item.playlistId ?? i}
              item={item}
              onPlay={() => item.videoId && playSong(item)}
            />
          ))}
          {search.data?.results?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum resultado.</p>
          )}
        </div>
      ) : (
        <>
          {/* Seções da home */}
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {homeData?.sections?.map((section, i) => (
            <div key={i} className="space-y-3">
              <h2 className="text-lg font-bold">{section.title}</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {section.contents.map((item, j) => (
                  <MusicCard
                    key={item.playlistId ?? item.videoId ?? j}
                    item={item}
                    onClick={() => {
                      if (item.videoId) {
                        playSong(item, section.contents.filter((c) => c.videoId));
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Mini player fixo */}
      {currentVideo && (
        <MiniPlayer
          video={currentVideo}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          onNext={playNext}
          onPrev={playPrev}
          onClose={() => { setCurrentVideo(null); setIsPlaying(false); }}
          hasNext={playlistIndex < playlist.length - 1}
          hasPrev={playlistIndex > 0}
        />
      )}
    </div>
  );
}

function MusicCard({ item, onClick }: { item: MusicItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-40 shrink-0 flex-col gap-2 text-left"
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-white/[0.06]">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Play className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
          <Play className="h-8 w-8 text-white" />
        </div>
      </div>
      <p className="line-clamp-2 text-sm font-semibold leading-tight">{item.name}</p>
      {item.artist && (
        <p className="line-clamp-1 text-xs text-muted-foreground">{item.artist}</p>
      )}
    </button>
  );
}

function MusicRow({ item, onPlay }: { item: MusicItem; onPlay: () => void }) {
  return (
    <button
      onClick={onPlay}
      disabled={!item.videoId}
      className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/[0.06] disabled:opacity-50"
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-white/[0.06]">
        {item.thumbnail && (
          <img src={item.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        {item.artist && (
          <p className="truncate text-xs text-muted-foreground">{item.artist}</p>
        )}
      </div>
      {item.duration && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, "0")}
        </span>
      )}
    </button>
  );
}

function MiniPlayer({
  video,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  onClose,
  hasNext,
  hasPrev,
}: {
  video: MusicItem;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}) {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);

  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.paddingBottom = "90px";
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingBottom = "";
    };
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0b141a]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2.5">
        {/* Capa + info */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {video.thumbnail && (
            <img src={video.thumbnail} alt="" className="h-12 w-12 rounded object-cover" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{video.name}</p>
            {video.artist && (
              <p className="truncate text-xs text-muted-foreground">{video.artist}</p>
            )}
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-2">
          {hasPrev && (
            <button onClick={onPrev} className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white">
              <Play className="h-4 w-4 rotate-180" />
            </button>
          )}
          <button
            onClick={onTogglePlay}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          {hasNext && (
            <button onClick={onNext} className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white">
              <Play className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* iframe hidden */}
      {isPlaying && video.videoId && (
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1&controls=0`}
          className="sr-only"
          allow="autoplay"
          title="player"
        />
      )}
    </div>
  );
}