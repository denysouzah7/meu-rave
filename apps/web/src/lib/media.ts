import type { CSSProperties } from "react";
import { resolveMediaUrl } from "@/services/api";

export function createMediaBackgroundStyle(
  url: string | null | undefined,
  overlayOpacity = 0.78
): CSSProperties | undefined {
  const mediaUrl = resolveMediaUrl(url);
  if (!mediaUrl) return undefined;

  const overlay = `rgba(7, 16, 20, ${overlayOpacity})`;

  return {
    backgroundImage: `linear-gradient(${overlay}, ${overlay}), url(${JSON.stringify(mediaUrl)})`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover"
  };
}
