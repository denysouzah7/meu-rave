import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { RoomStatus } from "@/services/types";
import { resolveMediaUrl } from "@/services/api";

export function StatusViewer({
  statuses,
  initialIndex,
  onClose,
}: {
  statuses: RoomStatus[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = React.useState(initialIndex);
  const status = statuses[index];

  const goNext = React.useCallback(() => {
    if (index < statuses.length - 1) setIndex((i) => i + 1);
    else onClose();
  }, [index, statuses.length, onClose]);

  const goPrev = React.useCallback(() => {
    if (index > 0) setIndex((i) => i - 1);
  }, [index]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  if (!status) return null;

  const total = statuses.length;
  const isVideo = status.type === "video";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Progress bars */}
      <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-2 pt-2">
        {statuses.map((s, i) => (
          <div key={s.id} className="h-[3px] flex-1 rounded-full bg-white/30">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-300"
              style={{
                width: i < index ? "100%" : i === index ? "100%" : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-2 pt-7">
        <span />
        <button
          type="button"
          aria-label="Fechar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Media area */}
      <div className="relative flex flex-1 items-center justify-center">
        {isVideo ? (
          <video
            key={status.id}
            src={resolveMediaUrl(status.mediaUrl)}
            autoPlay
            muted
            loop
            playsInline
            className="max-h-full max-w-full"
          />
        ) : (
          <img
            key={status.id}
            src={resolveMediaUrl(status.mediaUrl)}
            alt={status.caption ?? "Status"}
            className="max-h-full max-w-full object-contain"
          />
        )}

        {/* Left tap zone */}
        {index > 0 && (
          <button
            type="button"
            aria-label="Anterior"
            className="absolute left-0 top-0 flex h-full w-1/3 items-center justify-start pl-2"
            onClick={goPrev}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white">
              <ChevronLeft className="h-6 w-6" />
            </span>
          </button>
        )}

        {/* Right tap zone */}
        {index < total - 1 && (
          <button
            type="button"
            aria-label="Proximo"
            className="absolute right-0 top-0 flex h-full w-1/3 items-center justify-end pr-2"
            onClick={goNext}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white">
              <ChevronRight className="h-6 w-6" />
            </span>
          </button>
        )}
      </div>

      {/* Caption */}
      {status.caption && (
        <div className="bg-gradient-to-t from-black/60 to-transparent px-6 pb-6 pt-12">
          <p className="text-center text-sm text-white/90">{status.caption}</p>
        </div>
      )}
    </div>
  );
}
