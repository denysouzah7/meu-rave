import * as React from "react";

export type PlayerSong = { id: string; name: string; artist?: string; thumbnail?: string | null; youtubeId?: string };

type PlayerState = {
  current: PlayerSong | null;
  isPlaying: boolean;
  queue: PlayerSong[];
  queueIndex: number;
};

type PlayerContextValue = PlayerState & {
  play: (song: PlayerSong, list?: PlayerSong[]) => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  setIsPlaying: (v: boolean) => void;
  setYoutubeId: (songId: string, youtubeId: string) => void;
  preloadedIds: React.MutableRefObject<Map<string, string>>;
};

const PlayerContext = React.createContext<PlayerContextValue | null>(null);

export function useMusicPlayer() {
  const ctx = React.useContext(PlayerContext);
  if (!ctx) throw new Error("useMusicPlayer must be inside MusicPlayerProvider");
  return ctx;
}

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<PlayerState>({
    current: null, isPlaying: false, queue: [], queueIndex: 0,
  });
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const preloadedIds = React.useRef<Map<string, string>>(new Map());

  const play = (song: PlayerSong, list?: PlayerSong[]) => {
    const q = list ?? [song];
    const idx = q.findIndex(s => s.id === song.id);
    setState({ queue: q, queueIndex: idx >= 0 ? idx : 0, current: song, isPlaying: true });
  };

  const next = () => {
    const { queue, queueIndex } = stateRef.current;
    if (queueIndex < queue.length - 1) {
      const n = queue[queueIndex + 1];
      if (!n?.youtubeId) return;
      setState(s => ({ ...s, queueIndex: queueIndex + 1, current: n, isPlaying: true }));
    }
  };

  const prev = () => {
    const { queue, queueIndex } = stateRef.current;
    if (queueIndex > 0) {
      const p = queue[queueIndex - 1];
      if (!p?.youtubeId) return;
      setState(s => ({ ...s, queueIndex: queueIndex - 1, current: p, isPlaying: true }));
    }
  };

  const stop = () => {
    setState({ current: null, isPlaying: false, queue: [], queueIndex: 0 });
  };

  const setYoutubeId = (songId: string, youtubeId: string) => {
    preloadedIds.current.set(songId, youtubeId);
  };

  const value: PlayerContextValue = { ...state, play, next, prev, stop, setIsPlaying: (v: boolean) => setState(s => ({ ...s, isPlaying: v })), setYoutubeId, preloadedIds };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}
