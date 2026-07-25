import * as React from "react";

declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void; } }

let ytReady = false; let ytCallbacks: (() => void)[] = [];

function loadYT(): Promise<void> {
  if (ytReady && window.YT?.Player) return Promise.resolve();
  return new Promise<void>((resolve) => {
    ytCallbacks.push(resolve);
    if (window.YT?.Player) { resolve(); return; }
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script"); tag.id = "yt-iframe-api"; tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    window.onYouTubeIframeAPIReady = () => { ytReady = true; ytCallbacks.forEach((cb) => cb()); ytCallbacks = []; };
  });
}

export type PlayerSong = { id: string; name: string; artist?: string; thumbnail?: string | null };

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
  userGesture: () => void;
};

const PlayerContext = React.createContext<PlayerContextValue | null>(null);

export function useMusicPlayer() {
  const ctx = React.useContext(PlayerContext);
  if (!ctx) throw new Error("useMusicPlayer must be inside MusicPlayerProvider");
  return ctx;
}

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<PlayerState>({
    current: null, isPlaying: false, isLoading: false,
    position: 0, duration: 0, queue: [], queueIndex: 0,
  });
  const playerRef = React.useRef<any>(null);
  const playerDivRef = React.useRef<HTMLDivElement | null>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    loadYT().then(() => {
      if (playerRef.current || !playerDivRef.current) return;
      playerRef.current = new window.YT.Player(playerDivRef.current, {
        height: "1", width: "1",
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: (e: any) => {
            // Pre-load a silent video so the player is "warm"
            e.target.cueVideoById("dQw4w9WgXcQ");
          },
          onStateChange: (e: any) => {
            const YT = window.YT; if (!YT) return;
            if (e.data === YT.PlayerState.PLAYING) setState(s => ({ ...s, isPlaying: true, isLoading: false }));
            else if (e.data === YT.PlayerState.PAUSED) setState(s => ({ ...s, isPlaying: false }));
            else if (e.data === YT.PlayerState.ENDED) autoNext();
            else if (e.data === YT.PlayerState.BUFFERING) setState(s => ({ ...s, isLoading: true }));
          },
          onError: () => { setState(s => ({ ...s, isLoading: false })); autoNext(); },
        },
      });
    });

    const posInterval = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        setState(s => ({ ...s, position: playerRef.current.getCurrentTime() || 0, duration: playerRef.current.getDuration() || 0 }));
      }
    }, 1000);
    return () => clearInterval(posInterval);
  }, []);

  const loadVideo = (videoId: string) => {
    setState(s => ({ ...s, isLoading: true }));
    const tryLoad = () => {
      if (playerRef.current?.loadVideoById) {
        playerRef.current.loadVideoById(videoId);
        playerRef.current.playVideo();
      } else {
        setTimeout(tryLoad, 100);
      }
    };
    tryLoad();
  };

  const autoNext = () => {
    const { queue, queueIndex } = stateRef.current;
    if (queueIndex < queue.length - 1) {
      const n = queue[queueIndex + 1];
      if (!n) return;
      setState(s => ({ ...s, queueIndex: queueIndex + 1, current: n, isPlaying: true }));
      if (n.id) loadVideo(n.id);
    } else setState(s => ({ ...s, isPlaying: false }));
  };

  const play = (song: PlayerSong, list?: PlayerSong[]) => {
    if (!song.id) return;
    const q = list ?? [song];
    const idx = q.findIndex((s) => s.id === song.id);
    setState({ ...stateRef.current, queue: q, queueIndex: idx >= 0 ? idx : 0, current: song, isPlaying: true, isLoading: true });
    setTimeout(() => loadVideo(song.id), 0);
  };

  React.useEffect(() => {
    if (!state.current || !state.isPlaying) return;
    // re-sync if current changed but video not loaded
  }, [state.current]);

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (state.isPlaying) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  };

  const next = () => {
    const { queue, queueIndex } = stateRef.current;
    if (queueIndex < queue.length - 1) {
      const n = queue[queueIndex + 1]; if (!n) return;
      setState(s => ({ ...s, queueIndex: queueIndex + 1, current: n, isPlaying: true }));
      loadVideo(n.id);
    }
  };

  const prev = () => {
    const { queue, queueIndex } = stateRef.current;
    if (queueIndex > 0) {
      const p = queue[queueIndex - 1]; if (!p) return;
      setState(s => ({ ...s, queueIndex: queueIndex - 1, current: p, isPlaying: true }));
      loadVideo(p.id);
    }
  };

  const stop = () => {
    playerRef.current?.stopVideo();
    setState({ ...stateRef.current, current: null, isPlaying: false, queue: [], queueIndex: 0, position: 0, duration: 0 });
  };

  const seekForward = () => {
    if (!playerRef.current?.seekTo) return;
    playerRef.current.seekTo(Math.min((playerRef.current.getCurrentTime() || 0) + 15, playerRef.current.getDuration() || 0), true);
  };
  const seekBackward = () => {
    if (!playerRef.current?.seekTo) return;
    playerRef.current.seekTo(Math.max((playerRef.current.getCurrentTime() || 0) - 15, 0), true);
  };
  const seekTo = (pct: number) => {
    if (!playerRef.current?.seekTo || !state.duration) return;
    playerRef.current.seekTo(pct * state.duration, true);
  };

  const userGesture = () => {
    try {
      if (playerRef.current?.playVideo) playerRef.current.playVideo();
    } catch {}
  };

  const value: PlayerContextValue = { ...state, play, togglePlay, next, prev, stop, seekForward, seekBackward, seekTo, userGesture };

  return (
    <PlayerContext.Provider value={value}>
      <div ref={playerDivRef} style={{ position: "fixed", left: 0, top: 0, width: 2, height: 2, opacity: 0.01, pointerEvents: "none" }} />
      {children}
    </PlayerContext.Provider>
  );
}
