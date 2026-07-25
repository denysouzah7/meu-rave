import * as React from "react";
import { Search, Play, X, Pause, ChevronLeft, SkipBack, SkipForward, Loader2, Disc3, RotateCcw, RotateCw, ChevronDown } from "lucide-react";
import { useMusicHome, useMusicSearch, useAlbum, useArtistData, useYouTubeId, type MusicItem } from "@/hooks/useMusic";
import { useMusicPlayer, type PlayerSong } from "@/contexts/MusicPlayerContext";
import { api } from "@/services/api";

function CoverImg({ src, alt, className }: { src: string | null | undefined; alt: string; className: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) return <div className={cn(className, "flex items-center justify-center bg-white/[0.08]")}><Disc3 className="h-5 w-5 text-primary/60" /></div>;
  return <img src={src} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} />;
}
function cn(...classes: any[]) { return classes.filter(Boolean).join(" "); }

export function MusicPage() {
  const player = useMusicPlayer();
  const { data: homeData, isLoading } = useMusicHome();
  const [query, setQuery] = React.useState("");
  const [showSearch, setShowSearch] = React.useState(false);
  const [collectionView, setCollectionView] = React.useState<{ songs: MusicItem[]; name: string; thumbnail?: string | null } | null>(null);
  const [activeAlbumId, setActiveAlbumId] = React.useState<string | null>(null);
  const [activeArtistId, setActiveArtistId] = React.useState<string | null>(null);
  const [playerExpanded, setPlayerExpanded] = React.useState(false);
  const [resolvingSong, setResolvingSong] = React.useState<PlayerSong | null>(null);

  const search = useMusicSearch(query);
  const albumData = useAlbum(activeAlbumId ?? "");
  const artistData = useArtistData(activeArtistId ?? "");

  // YouTube ID resolution for playable songs
  React.useEffect(() => {
    if (!resolvingSong) return;
    const { name, artist } = resolvingSong;
    if (!name) { setResolvingSong(null); return; }
    // defer to hook
    const fetchId = async () => {
      try {
        const data = await api<{ videoId: string | null }>(`/music/youtube-id?name=${encodeURIComponent(name)}&artist=${encodeURIComponent(artist || "")}`);
        if (data.videoId) {
          player.play({ ...resolvingSong, id: data.videoId });
        }
      } catch {}
      setResolvingSong(null);
    };
    fetchId();
  }, [resolvingSong]);

  // Album data effect
  React.useEffect(() => {
    if (albumData.data?.songs && activeAlbumId) setCollectionView({ songs: albumData.data.songs, name: collectionView?.name ?? "Album", thumbnail: collectionView?.thumbnail ?? null });
  }, [albumData.data, activeAlbumId]);

  // Artist data effect
  React.useEffect(() => {
    if (artistData.data && activeArtistId) setCollectionView({ songs: artistData.data.songs, name: collectionView?.name ?? "Artista", thumbnail: collectionView?.thumbnail ?? null });
  }, [artistData.data, activeArtistId]);

  /* Actions */
  const playSong = (song: MusicItem, list?: MusicItem[]) => {
    setResolvingSong({ id: "", name: song.name, artist: song.artist ?? "", thumbnail: song.thumbnail ?? "" });
    if (list) {
      // queue will be managed by player's play function - we just pass the current
    }
  };

  // Override play once resolved (handled in effect above via setResolvingSong -> player.play)
  // For direct songs (from search with specific handling):
  const handleItemClick = (item: MusicItem, list?: MusicItem[]) => {
    if (item.type === "album" && item.id) { setActiveArtistId(null); setActiveAlbumId(item.id); setCollectionView({ songs: [], name: item.name, thumbnail: item.thumbnail ?? null }); }
    else if (item.type === "artist" && item.id) { setActiveAlbumId(null); setActiveArtistId(item.id); setCollectionView({ songs: [], name: item.name, thumbnail: item.thumbnail ?? null }); }
    else if (item.id) {
      // Need YouTube ID - resolve via backend
      setResolvingSong({ id: "", name: item.name, artist: item.artist ?? "", thumbnail: item.thumbnail ?? "" });
    }
  };

  const closeCollection = () => { setCollectionView(null); setActiveAlbumId(null); setActiveArtistId(null); };

  const pct = player.duration > 0 ? (player.position / player.duration) * 100 : 0;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="space-y-6 pb-36 sm:pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        {collectionView ? (
          <>
            <button type="button" onClick={closeCollection} className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"><ChevronLeft className="h-5 w-5" /></button>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {collectionView.thumbnail && <CoverImg src={collectionView.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />}
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-white">{collectionView.name}</h1>
                <p className="text-xs text-muted-foreground">{collectionView.songs.length} musicas</p>
              </div>
            </div>
          </>
        ) : showSearch ? (
          <>
            <button type="button" onClick={() => { setShowSearch(false); setQuery(""); }} className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"><ChevronLeft className="h-5 w-5" /></button>
            <div className="flex flex-1 items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-muted-foreground" />
              {query && <button type="button" onClick={() => setQuery("")}><X className="h-4 w-4 text-muted-foreground" /></button>}
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white">Musica</h1>
            <button type="button" onClick={() => setShowSearch(true)} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white hover:bg-white/10"><Search className="h-5 w-5" /></button>
          </>
        )}
      </div>

      {/* Collection view */}
      {collectionView && (
        <div className="space-y-4">
          {!albumData.isFetched && !artistData.isFetched && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {(albumData.isFetched || artistData.isFetched) && collectionView.songs.length === 0 && <p className="text-sm text-muted-foreground pt-4 text-center">Nenhuma musica encontrada.</p>}
          {collectionView.songs.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white/70 px-1">Musicas</h3>
              {collectionView.songs.map((song, i) => (
                <button key={song.id ?? i} type="button" onClick={() => handleItemClick(song, collectionView.songs)}
                  className={"flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/[0.06]" + (player.current?.id === song.id ? " bg-primary/[0.12]" : "")}>
                  <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">
                    {player.current?.id === song.id && player.isPlaying ? <span className="inline-block h-3 w-3 rounded-full bg-primary animate-pulse" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={"truncate text-sm" + (player.current?.id === song.id ? " text-primary" : " text-white")}>{song.name}</p>
                    {song.artist && <p className="truncate text-xs text-muted-foreground">{song.artist}</p>}
                  </div>
                  {song.duration && <span className="shrink-0 text-xs text-muted-foreground">{Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, "0")}</span>}
                </button>
              ))}
            </div>
          )}
          {activeArtistId && artistData.data?.albums && artistData.data.albums.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white/70 px-1">Albuns</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 thin-scrollbar px-1">
                {artistData.data.albums.map((album: MusicItem) => (
                  <button key={album.id} type="button" onClick={() => handleItemClick(album)} className="group flex w-36 shrink-0 flex-col gap-2 text-left">
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-white/[0.06]">
                      {album.thumbnail ? <CoverImg src={album.thumbnail} alt={album.name} className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center"><Disc3 className="h-8 w-8 text-muted-foreground" /></div>}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100"><Play className="h-8 w-8 text-white" fill="white" /></div>
                    </div>
                    <p className="line-clamp-2 text-xs font-medium leading-tight text-white">{album.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search results */}
      {!collectionView && showSearch && query && (
        <div className="space-y-2">
          {search.isLoading && <p className="text-sm text-muted-foreground">Buscando...</p>}
          {search.data?.results?.map((item, i) => (
            <SearchRow key={item.id ?? i} item={item} onPlay={() => handleItemClick(item)} />
          ))}
          {search.data?.results?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum resultado.</p>}
        </div>
      )}

      {/* Home */}
      {!collectionView && !(showSearch && query) && (
        <>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {homeData?.sections?.map((section, i) => (
            <div key={i} className="space-y-3">
              <h2 className="text-lg font-bold text-white">{section.title}</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 thin-scrollbar">
                {section.contents.map((item, j) => (
                  <HomeCard key={item.id ?? j} item={item} onClick={() => handleItemClick(item)} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Mini / Expanded player */}
      {player.current && (
        <PlayerBar
          current={player.current}
          isPlaying={player.isPlaying}
          isLoading={player.isLoading || !!resolvingSong}
          position={player.position} duration={player.duration}
          hasPrev={player.queueIndex > 0} hasNext={player.queueIndex < player.queue.length - 1}
          expanded={playerExpanded}
          onToggleExpand={() => setPlayerExpanded(!playerExpanded)}
          onTogglePlay={player.togglePlay}
          onNext={player.next} onPrev={player.prev} onClose={player.stop}
          onSkipForward={player.seekForward} onSkipBackward={player.seekBackward}
          onSeek={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            player.seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
          }}
        />
      )}
    </div>
  );
}

/* Components */
function HomeCard({ item, onClick }: { item: MusicItem; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-36 sm:w-40 shrink-0 flex-col gap-2 text-left">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-white/[0.06]">
        {item.thumbnail ? <CoverImg src={item.thumbnail} alt={item.name} className="h-full w-full object-cover transition group-hover:scale-105" /> : (
          <div className="flex h-full w-full items-center justify-center"><Disc3 className="h-8 w-8 text-muted-foreground" /></div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100"><Play className="h-8 w-8 text-white" fill="white" /></div>
      </div>
      <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{item.name}</p>
      {item.artist && <p className="line-clamp-1 text-xs text-muted-foreground">{item.artist}</p>}
    </button>
  );
}

function SearchRow({ item, onPlay }: { item: MusicItem; onPlay: () => void }) {
  return (
    <button type="button" onClick={onPlay} disabled={!item.id} className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/[0.06] disabled:opacity-50">
      <div className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 overflow-hidden rounded bg-white/[0.06]">
        {item.thumbnail && <CoverImg src={item.thumbnail} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{item.name}</p>
        {item.artist && <p className="truncate text-xs text-muted-foreground">{item.artist}</p>}
      </div>
      {item.duration && <span className="shrink-0 text-xs text-muted-foreground">{Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, "0")}</span>}
      {item.type === "album" && <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-muted-foreground">Album</span>}
      {item.type === "artist" && <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-muted-foreground">Artista</span>}
    </button>
  );
}

function PlayerBar({ current, isPlaying, isLoading, position, duration, hasPrev, hasNext, expanded, onToggleExpand, onTogglePlay, onNext, onPrev, onClose, onSkipForward, onSkipBackward, onSeek }: {
  current: PlayerSong; isPlaying: boolean; isLoading: boolean; position: number; duration: number;
  hasPrev: boolean; hasNext: boolean; expanded: boolean;
  onToggleExpand: () => void; onTogglePlay: () => void; onNext: () => void; onPrev: () => void; onClose: () => void;
  onSkipForward: () => void; onSkipBackward: () => void; onSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  React.useEffect(() => { document.body.style.paddingBottom = expanded ? "0" : "80px"; return () => { document.body.style.paddingBottom = ""; }; }, [expanded]);
  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#0b141a]">
        <div className="flex items-center justify-between px-4 pt-4">
          <button type="button" onClick={onToggleExpand} className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:text-white"><ChevronDown className="h-6 w-6" /></button>
          <p className="text-xs font-semibold text-white/60">Tocando agora</p>
          <span className="h-9 w-9" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 sm:px-8">
          <div className="w-full max-w-xs sm:max-w-sm">
            <div className="mb-6 sm:mb-8 aspect-square w-full overflow-hidden rounded-2xl bg-white/[0.06] shadow-2xl">
              {current.thumbnail ? <img src={current.thumbnail} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Disc3 className="h-20 w-20 text-muted-foreground/50" /></div>}
            </div>
            <div className="mb-6 min-w-0">
              <p className="truncate text-xl font-bold text-white">{current.name}</p>
              {current.artist && <p className="truncate text-sm text-muted-foreground">{current.artist}</p>}
            </div>
            <div className="mb-2 h-1.5 w-full cursor-pointer rounded-full bg-white/10" onClick={onSeek}><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} /></div>
            <div className="mb-8 flex justify-between text-xs text-muted-foreground"><span>{formatTime(position)}</span><span>{formatTime(duration)}</span></div>
            {isLoading && <div className="flex justify-center mb-6"><Loader2 className="h-6 w-6 animate-spin text-white/60" /></div>}
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <button type="button" onClick={onSkipBackward} className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-white/50 hover:text-white"><RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" /></button>
              {hasPrev && <button type="button" onClick={onPrev} className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-white/60 hover:text-white"><SkipBack className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" /></button>}
              <button type="button" onClick={onTogglePlay} className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:scale-105">{isPlaying ? <Pause className="h-6 w-6 sm:h-7 sm:w-7" fill="currentColor" /> : <Play className="h-6 w-6 sm:h-7 sm:w-7" fill="currentColor" />}</button>
              {hasNext && <button type="button" onClick={onNext} className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-white/60 hover:text-white"><SkipForward className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" /></button>}
              <button type="button" onClick={onSkipForward} className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-white/50 hover:text-white"><RotateCw className="h-4 w-4 sm:h-5 sm:w-5" /></button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-14 sm:bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0b141a]/95 backdrop-blur-xl lg:bottom-0">
      <div className="h-1 w-full cursor-pointer bg-white/10" onClick={onSeek}><div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} /></div>
      <div className="mx-auto flex max-w-[1500px] items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-2.5" onClick={onToggleExpand} style={{ cursor: "pointer" }}>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {current.thumbnail && <CoverImg src={current.thumbnail} alt="" className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded object-cover" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{current.name}</p>
            {current.artist && <p className="truncate text-xs text-muted-foreground">{current.artist}</p>}
            <p className="text-[10px] text-muted-foreground">{formatTime(position)} / {formatTime(duration)}</p>
          </div>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={onSkipBackward} className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:text-white"><RotateCcw className="h-4 w-4" /></button>
          {hasPrev && <button type="button" onClick={onPrev} className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:text-white"><SkipBack className="h-4 w-4" fill="currentColor" /></button>}
          <button type="button" onClick={onTogglePlay} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition hover:scale-105">{isPlaying ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}</button>
          {hasNext && <button type="button" onClick={onNext} className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:text-white"><SkipForward className="h-4 w-4" fill="currentColor" /></button>}
          <button type="button" onClick={onSkipForward} className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:text-white"><RotateCw className="h-4 w-4" /></button>
          <button type="button" onClick={onClose} className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
