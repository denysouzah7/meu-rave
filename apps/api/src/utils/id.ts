import { customAlphabet } from "nanoid";

const publicId = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  14
);

const slugId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 9);

export function createId(prefix: string) {
  return `${prefix}_${publicId()}`;
}

export function normalizeRoomSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function createRoomSlug(name?: string) {
  const slug = name ? normalizeRoomSlug(name) : "";
  return slug || slugId();
}
