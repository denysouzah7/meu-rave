export type User = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: "admin" | "participant";
  isBlocked: boolean;
  blockedReason?: string | null;
  profileTheme?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Room = {
  id: string;
  slug: string;
  name: string;
  bannerUrl?: string | null;
  description: string;
  category: string;
  creatorId: string;
  creatorName?: string | null;
  creatorImage?: string | null;
  isActive: boolean;
  endedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Participant = {
  id: string;
  roomId: string;
  userId: string;
  role: "administrator" | "moderator" | "participant" | "viewer";
  canWatch: boolean;
  canChat: boolean;
  canSendAudio: boolean;
  canModerate: boolean;
  isMuted: boolean;
  isBanned: boolean;
  bannedReason?: string | null;
  online: boolean;
  joinedAt: string;
  lastSeenAt: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  globalRole?: "admin" | "participant";
};

export type RoomContent = {
  id: string;
  roomId: string;
  videoId: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  sourceType: "upload" | "youtube" | "direct";
  sourceUrl: string;
  durationSeconds?: number | null;
  mimeType?: string | null;
};

export type PlaybackState = {
  roomId: string;
  contentId?: string | null;
  isPlaying: boolean;
  positionSeconds: number;
  updatedAt: string;
  updatedByUserId?: string | null;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  userId?: string | null;
  type: "text" | "sticker" | "audio" | "system";
  body?: string | null;
  replyToMessageId?: string | null;
  stickerId?: string | null;
  audioId?: string | null;
  isPinned: boolean;
  deletedAt?: string | null;
  createdAt: string;
  authorName?: string | null;
  authorImage?: string | null;
  authorRole?: "admin" | "participant" | null;
  stickerName?: string | null;
  stickerUrl?: string | null;
  audioUrl?: string | null;
  audioDuration?: number | null;
  likes?: number;
};

export type Sticker = {
  id: string;
  packId: string;
  uploadId: string;
  name: string;
  imageUrl: string;
  createdAt: string;
};

export type StickerPack = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  stickers: Sticker[];
};

export type RoomPayload = {
  room: Room;
  participant: Participant;
  contents: RoomContent[];
  playback: PlaybackState;
  participants: Participant[];
  messages: ChatMessage[];
  pinnedMessages: ChatMessage[];
};
