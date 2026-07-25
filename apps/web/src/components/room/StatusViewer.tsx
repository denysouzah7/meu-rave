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
  if (!status) return null;

  const total = statuses.length;
  const isVideo = status.type === "video";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bars */}
        <div className="absolute left-0 right-0 top-0 z-10 flex gap-1 px-2 pt-2">
          {statuses.map((s, i) => (
            <div
              key={s.id}
              className="h-0.5 flex-1 rounded-full bg-white/30"
            >
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{
                  width: i < index ? "100%" : i === index ? "100%" : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Close button */}
        <button
          type="button"
          aria-label="Fechar"
          className="absolute right-2 top-8 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Media */}
        <div className="flex items-center justify-center">
          {isVideo ? (
            <video
              src={resolveMediaUrl(status.mediaUrl)}
              controls
              autoPlay
              className="max-h-[80vh] max-w-full rounded-lg"
            />
          ) : (
            <img
              src={resolveMediaUrl(status.mediaUrl)}
              alt={status.caption ?? "Status"}
              className="max-h-[80vh] max-w-full rounded-lg object-contain"
            />
          )}
        </div>

        {/* Caption */}
        {status.caption && (
          <p className="mt-2 text-center text-sm text-white/80">
            {status.caption}
          </p>
        )}

        {/* Navigation */}
        {total > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {index > 0 && (
              <button
                type="button"
                className="rounded-full bg-white/20 px-4 py-1 text-sm text-white"
                onClick={() => setIndex(index - 1)}
              >
                Anterior
              </button>
            )}
            {index < total - 1 && (
              <button
                type="button"
                className="rounded-full bg-white/20 px-4 py-1 text-sm text-white"
                onClick={() => setIndex(index + 1)}
              >
                Proximo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
