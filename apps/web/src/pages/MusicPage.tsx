import * as React from "react";
import { Search, Play, X, ChevronLeft, Disc3 } from "lucide-react";
import { useMusicHome, useMusicSearch, type MusicItem } from "@/hooks/useMusic";
import { useMusicPlayer, type PlayerSong } from "@/contexts/MusicPlayerContext";

function CoverImg({ src, alt, className }: { src: string | null | undefined; alt: string; className: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) return <div className={className.replace(/object-cover/g, "") + " flex items-center justify-center bg-white/[0.08]"}><Disc3 className="h-5 w-5 text-primary/60" /></div>;
  return <img src={String(src)} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} />;
}

export function MusicPage() {
  const player = useMusicPlayer();
  const { data: homeData, isLoading } = useMusicHome();
  const [query, setQuery] = React.useState("");
  const [showSearch, setShowSearch] = React.useState(false);
  const [collectionView, setCollectionView] = React.useState<{ songs: MusicItem[]; name: string; thumbnail?: string | null } | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeType, setActiveType] = React.useState<"album" | "artist" | null>(null);
  const [fetchedSongs, setFetchedSongs] = React.useState<MusicItem[]>([]);
  const [albums, setAlbums] = React.useState<MusicItem[]>([]);

  const search = useMusicSearch(query);

  React.useEffect(() => {
    if (!collectionView) return;
    if (!activeId || !activeType) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/music/${activeType}/${activeId}`);
        const data = await res.json();
        setFetchedSongs(data.songs ?? []);
        if (activeType === "artist") setAlbums(data.albums ?? []);
      } catch { setFetchedSongs([]); }
    };
    fetchData();
  }, [activeId, activeType, collectionView]);

  const toPlayerSong = (item: MusicItem): PlayerSong => ({
    id: item.id, name: item.name, thumbnail: item.thumbnail ?? null,
    ...(item.artist ? { artist: item.artist! } : {}),
  });

  const handleItemClick = (item: MusicItem, list?: MusicItem[]) => {
    if (item.type === "album" && item.id) { openCollection(item.id, "album", item.name, item.thumbnail); }
    else if (item.type === "artist" && item.id) { openCollection(item.id, "artist", item.name, item.thumbnail); }
    else if (item.id) {
      const ps = toPlayerSong(item);
      const plist = list?.map(toPlayerSong);
      player.play(ps, plist);
    }
  };

  const openCollection = (id: string, type: "album" | "artist", name: string, thumbnail?: string | null) => {
    setActiveId(id); setActiveType(type);
    setCollectionView({ songs: [], name, thumbnail: thumbnail ?? null });
    setFetchedSongs([]); setAlbums([]);
  };

  const closeCollection = () => { setCollectionView(null); setActiveId(null); setActiveType(null); };

  return (
    <div className="space-y-6 pb-40 sm:pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        {collectionView ? (
          <>
            <button onClick={closeCollection} className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"><ChevronLeft className="h-5 w-5" /></button>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {collectionView.thumbnail && <CoverImg src={collectionView.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />}
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-white">{collectionView.name}</h1>
                <p className="text-xs text-muted-foreground">{fetchedSongs.length} musicas</p>
              </div>
            </div>
          </>
        ) : showSearch ? (
          <>
            <button onClick={() => { setShowSearch(false); setQuery(""); }} className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"><ChevronLeft className="h-5 w-5" /></button>
            <div className="flex flex-1 items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar..." className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-muted-foreground" />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white">Musica</h1>
            <button onClick={() => setShowSearch(true)} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white hover:bg-white/10"><Search className="h-5 w-5" /></button>
          </>
        )}
      </div>

      {/* Collection */}
      {collectionView && (
        <div className="space-y-4">
          {fetchedSongs.length === 0 && <p className="text-sm text-muted-foreground pt-4 text-center">Carregando...</p>}
          <div className="space-y-1">
            {fetchedSongs.map((song, i) => (
              <button key={song.id ?? i} onClick={() => handleItemClick(song, fetchedSongs)}
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
          {albums.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white/70 px-1">Albuns</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 thin-scrollbar px-1">
                {albums.map(album => (
                  <button key={album.id} onClick={() => handleItemClick(album)} className="group flex w-36 shrink-0 flex-col gap-2 text-left">
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

      {/* Search */}
      {!collectionView && showSearch && query && (
        <div className="space-y-2">
          {search.isLoading && <p className="text-sm text-muted-foreground">Buscando...</p>}
          {search.data?.results?.map((item, i) => (
            <button key={item.id ?? i} onClick={() => handleItemClick(item)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/[0.06]">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-white/[0.06]">
                {item.thumbnail && <CoverImg src={item.thumbnail} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{item.name}</p>
                {item.artist && <p className="truncate text-xs text-muted-foreground">{item.artist}</p>}
              </div>
              {item.duration && <span className="shrink-0 text-xs text-muted-foreground">{Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, "0")}</span>}
              {item.type === "album" && <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px]">Album</span>}
              {item.type === "artist" && <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px]">Artista</span>}
            </button>
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
                  <button key={item.id ?? j} onClick={() => handleItemClick(item)} className="group flex w-36 sm:w-40 shrink-0 flex-col gap-2 text-left">
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-white/[0.06]">
                      {item.thumbnail ? <CoverImg src={item.thumbnail} alt={item.name} className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center"><Disc3 className="h-8 w-8 text-muted-foreground" /></div>}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100"><Play className="h-8 w-8 text-white" fill="white" /></div>
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{item.name}</p>
                    {item.artist && <p className="line-clamp-1 text-xs text-muted-foreground">{item.artist}</p>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
