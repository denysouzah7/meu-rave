import type { MultipartFile } from "@fastify/multipart";
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { db } from "../database/client.js";
import { uploads, type Upload } from "../database/schema.js";
import { env } from "../config/env.js";
import { createId } from "../utils/id.js";
import { badRequest } from "../utils/http.js";
import { now } from "../utils/dates.js";

export type UploadKind = "video" | "image" | "sticker" | "avatar" | "audio";
export type UploadFileRef = Pick<Upload, "type" | "filename">;

const allowedMime: Record<UploadKind, RegExp> = {
  video: /^video\//,
  image: /^image\//,
  sticker: /^image\//,
  avatar: /^image\//,
  audio: /^audio\//
};

function safeExtension(filename: string, mimeType: string) {
  const ext = extname(filename).toLowerCase();
  if (ext) {
    return ext.replace(/[^a-z0-9.]/g, "");
  }
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("mpeg")) return ".mp3";
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("jpeg")) return ".jpg";
  if (mimeType.includes("mp4")) return ".mp4";
  return ".bin";
}

export async function saveUpload(file: MultipartFile, userId: string, type: UploadKind): Promise<Upload> {
  if (!allowedMime[type].test(file.mimetype)) {
    throw badRequest(`Arquivo invalido para ${type}`);
  }

  const id = createId("upl");
  const dir = resolve(process.cwd(), env.UPLOAD_DIR, type);
  mkdirSync(dir, { recursive: true });

  const filename = `${id}${safeExtension(file.filename, file.mimetype)}`;
  const path = resolve(dir, filename);

  let size = 0;
  file.file.on("data", (chunk: Buffer) => {
    size += chunk.length;
  });

  await pipeline(file.file, createWriteStream(path));

  const url = `${env.PUBLIC_API_URL}/uploads/${type}/${filename}`;
  const [saved] = db
    .insert(uploads)
    .values({
      id,
      userId,
      type,
      originalName: file.filename,
      filename,
      mimeType: file.mimetype,
      size,
      url,
      createdAt: now()
    })
    .returning()
    .all();

  if (!saved) {
    throw badRequest("Nao foi possivel salvar o upload");
  }

  return saved;
}

function resolveUploadPath(upload: UploadFileRef) {
  const dir = resolve(process.cwd(), env.UPLOAD_DIR, upload.type);
  const path = resolve(dir, upload.filename);
  const relativePath = relative(dir, path);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return path;
}

export function deleteUploadFiles(files: UploadFileRef[]) {
  for (const file of files) {
    const path = resolveUploadPath(file);
    if (!path || !existsSync(path)) {
      continue;
    }

    try {
      unlinkSync(path);
    } catch {
      // The database cleanup should not fail because a file was already gone or locked.
    }
  }
}
