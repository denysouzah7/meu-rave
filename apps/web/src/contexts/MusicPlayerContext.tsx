import * as React from "react";

export type PlayerSong = { id: string; name: string; artist?: string; thumbnail?: string | null; previewUrl?: string };

type PlayerState = {
  current: PlayerSong | null;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  queue: PlayerSong[];
  queueIndex: number;
};

type PlayerContextValue = PlayerState & {
  play: (song: PlayerSong, list?: PlayerSong[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  seekForward: () => void;
  seekBackward: () => void;
  seekTo: (pct: number) => void;
};

const PlayerContext = React.createContext<PlayerContextValue | null>(null);

export function useMusicPlayer() {
  const ctx = React.useContext(PlayerContext);
  if (!ctx) throw new Error("useMusicPlayer must be inside MusicPlayerProvider");
  return ctx;
}

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [state, setState] = React.useState<PlayerState>({
    current: null, isPlaying: false, isLoading: false,
    position: 0, duration: 0, queue: [], queueIndex: 0,
  });
  const stateRef = React.useRef(state);
  stateRef.current = state;

  const loadAndPlay = (url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    setState(s => ({ ...s, isLoading: true }));
    audio.src = url;
    audio.load();
    audio.play().then(() => {
      setState(s => ({ ...s, isPlaying: true, isLoading: false, duration: audio.duration || 0 }));
    }).catch(() => {
      setState(s => ({ ...s, isPlaying: false, isLoading: false }));
    });
  };

  const play = (song: PlayerSong, list?: PlayerSong[]) => {
    if (!song.previewUrl) return;
    const q = list ?? [song];
    const idx = q.findIndex((s) => s.id === song.id);
    setState({
      ...stateRef.current, queue: q, queueIndex: idx >= 0 ? idx : 0,
      current: song, isPlaying: false, isLoading: true, position: 0, duration: 0,
    });
    loadAndPlay(song.previewUrl);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().then(() => setState(s => ({ ...s, isPlaying: true }))).catch(() => {});
    else { audio.pause(); setState(s => ({ ...s, isPlaying: false })); }
  };

  const autoNext = () => {
    const { queue, queueIndex } = stateRef.current;
    if (queueIndex < queue.length - 1) {
      const n = queue[queueIndex + 1];
      if (!n || !n.previewUrl) return;
      setState(s => ({ ...s, queueIndex: queueIndex + 1, current: n }));
      loadAndPlay(n.previewUrl);
    } else {
      setState(s => ({ ...s, isPlaying: false }));
    }
  };

  const next = () => {
    const { queue, queueIndex } = stateRef.current;
    if (queueIndex < queue.length - 1) {
      const n = queue[queueIndex + 1]; if (!n || !n.previewUrl) return;
      setState(s => ({ ...s, queueIndex: queueIndex + 1, current: n }));
      loadAndPlay(n.previewUrl);
    }
  };

  const prev = () => {
    const { queue, queueIndex } = stateRef.current;
    if (queueIndex > 0) {
      const p = queue[queueIndex - 1]; if (!p || !p.previewUrl) return;
      setState(s => ({ ...s, queueIndex: queueIndex - 1, current: p }));
      loadAndPlay(p.previewUrl);
    }
  };

  const stop = () => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ""; }
    setState({ ...stateRef.current, current: null, isPlaying: false, queue: [], queueIndex: 0, position: 0, duration: 0 });
  };

  const seekForward = () => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.min(audio.currentTime + 15, audio.duration || 0);
  };
  const seekBackward = () => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(audio.currentTime - 15, 0);
  };
  const seekTo = (pct: number) => {
    const audio = audioRef.current;
    if (audio && audio.duration) audio.currentTime = pct * audio.duration;
  };

  // Poll position and handle track end
  React.useEffect(() => {
    const iv = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      setState(s => ({
        ...s,
        position: audio.currentTime || 0,
        duration: audio.duration || s.duration,
      }));
      // Auto-advance when track ends
      if (audio.ended && stateRef.current.isPlaying) autoNext();
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const value: PlayerContextValue = {
    ...state, play, togglePlay, next, prev, stop, seekForward, seekBackward, seekTo,
  };

  return (
    <PlayerContext.Provider value={value}>
      <audio ref={audioRef} preload="none" />
      {children}
    </PlayerContext.Provider>
  );
}
