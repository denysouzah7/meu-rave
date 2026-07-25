import * as React from "react";
import { X } from "lucide-react";
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

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

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
    <div className="fixed inset-0 z-50 bg-black select-none">
      {/* Fechar */}
      <button
        type="button"
        aria-label="Fechar"
        className="absolute right-2 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white/80"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </button>

      {/* Mídia */}
      <div
        className="absolute inset-0"
        onClick={(e) => {
          const w = e.currentTarget.offsetWidth;
          const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
          if (x < w / 3) goPrev();
          else if (x > (w / 3) * 2) goNext();
          else onClose();
        }}
      >
        {isVideo ? (
          <video
            key={status.id}
            src={resolveMediaUrl(status.mediaUrl)}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            key={status.id}
            src={resolveMediaUrl(status.mediaUrl)}
            alt={status.caption ?? "Status"}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      {/* Legenda */}
      {status.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-4 pb-4 pt-8">
          <p className="text-center text-sm text-white/80">{status.caption}</p>
        </div>
      )}
    </div>
  );
}
