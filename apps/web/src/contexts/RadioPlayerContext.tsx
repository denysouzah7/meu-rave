import * as React from "react";
import { resolveMediaUrl } from "@/services/api";

type RadioSource = {
  url: string;
  title?: string | undefined;
};

type RadioPlayerContextValue = {
  currentUrl: string;
  title: string;
  isPlaying: boolean;
  isLoading: boolean;
  error: string;
  play: (source: RadioSource) => Promise<void>;
  toggle: (source: RadioSource) => Promise<void>;
  stop: () => void;
  isCurrent: (url: string | null | undefined) => boolean;
};

const RadioPlayerContext = React.createContext<RadioPlayerContextValue | null>(null);

export function RadioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [currentUrl, setCurrentUrl] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const stop = React.useCallback(() => {
    const audio = audioRef.current;
    audio?.pause();
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentUrl("");
    setTitle("");
    setError("");
  }, []);

  const play = React.useCallback(async (source: RadioSource) => {
    const nextUrl = resolveMediaUrl(source.url);
    const audio = audioRef.current;
    if (!audio || !nextUrl) return;

    setCurrentUrl(nextUrl);
    setTitle(source.title ?? "Web radio");
    setError("");
    setIsLoading(true);

    if (audio.src !== nextUrl) {
      audio.src = nextUrl;
      audio.load();
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setError("Nao foi possivel tocar a web radio.");
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggle = React.useCallback(
    async (source: RadioSource) => {
      const nextUrl = resolveMediaUrl(source.url);
      const audio = audioRef.current;
      if (!audio || !nextUrl) return;

      if (currentUrl === nextUrl && isPlaying) {
        audio.pause();
        setIsPlaying(false);
        setIsLoading(false);
        return;
      }

      await play({ url: nextUrl, title: source.title });
    },
    [currentUrl, isPlaying, play]
  );

  const isCurrent = React.useCallback(
    (url: string | null | undefined) => Boolean(url && resolveMediaUrl(url) === currentUrl),
    [currentUrl]
  );

  const value = React.useMemo<RadioPlayerContextValue>(
    () => ({
      currentUrl,
      title,
      isPlaying,
      isLoading,
      error,
      play,
      toggle,
      stop,
      isCurrent
    }),
    [currentUrl, error, isCurrent, isLoading, isPlaying, play, stop, title, toggle]
  );

  return (
    <RadioPlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => {
          setIsPlaying(true);
          setIsLoading(false);
          setError("");
        }}
        onPause={() => {
          setIsPlaying(false);
          setIsLoading(false);
        }}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onError={() => {
          setIsPlaying(false);
          setIsLoading(false);
          setError("Confira se a web radio esta ligada.");
        }}
      />
    </RadioPlayerContext.Provider>
  );
}

export function useRadioPlayer() {
  const context = React.useContext(RadioPlayerContext);
  if (!context) {
    throw new Error("useRadioPlayer must be used inside RadioPlayerProvider");
  }
  return context;
}
