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

  const goNext = () => {
    if (index < statuses.length - 1) setIndex(index + 1);
    else onClose();
  };
  const goPrev = () => {
    if (index > 0) setIndex(index - 1);
  };

  if (!status) return null;

  const total = statuses.length;
  const isVideo = status.type === "video";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Progress bars */}
      <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-2 pt-2">
        {statuses.map((s, i) => (
          <div key={s.id} className="h-0.5 flex-1 rounded-full bg-white/30">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{
                width: i < index ? "100%" : i === index ? "100%" : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Close */}
      <button
        type="button"
        aria-label="Fechar"
        className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>

      {/* Media - full screen */}
      <div
        className="relative flex flex-1 cursor-pointer items-center justify-center"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x < rect.width / 3 && index > 0) goPrev();
          else if (x > (rect.width * 2) / 3 && index < total - 1) goNext();
          else if (x > rect.width / 3 && x < (rect.width * 2) / 3) onClose();
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
            className="h-full w-full object-contain"
          />
        ) : (
          <img
            key={status.id}
            src={resolveMediaUrl(status.mediaUrl)}
            alt={status.caption ?? "Status"}
            className="h-full w-full object-contain"
          />
        )}

        {/* Dark overlays on sides for navigation hint */}
        {index > 0 && (
          <div
            className="absolute left-0 top-0 h-full w-1/3"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
          />
        )}
        {index < total - 1 && (
          <div
            className="absolute right-0 top-0 h-full w-1/3"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
          />
        )}
      </div>

      {/* Caption */}
      {status.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6 pt-12">
          <p className="text-center text-sm text-white/90">
            {status.caption}
          </p>
        </div>
      )}
    </div>
  );
}
