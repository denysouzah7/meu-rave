const STORAGE_PREFIX = "haru:joined-rooms";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function getJoinedRoomSlugs(userId: string | undefined) {
  if (!userId || typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const values = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(values)) {
      return new Set<string>();
    }
    return new Set(
      values.filter((value): value is string => typeof value === "string"),
    );
  } catch {
    return new Set<string>();
  }
}

export function markRoomJoined(
  userId: string | undefined,
  slug: string | undefined,
) {
  if (!userId || !slug || typeof window === "undefined") {
    return;
  }

  const current = getJoinedRoomSlugs(userId);
  current.add(slug);
  window.localStorage.setItem(storageKey(userId), JSON.stringify([...current]));
}
