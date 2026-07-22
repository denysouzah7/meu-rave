import { customAlphabet } from "nanoid";

const publicId = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  14
);

const slugId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 9);

export function createId(prefix: string) {
  return `${prefix}_${publicId()}`;
}

export function createRoomSlug() {
  return slugId();
}
