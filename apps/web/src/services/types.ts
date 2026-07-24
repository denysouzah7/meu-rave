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
  type: "rave" | "group";
  bannerUrl?: string | null;
  coverUrl?: string | null;
  backgroundUrl?: string | null;
  radioEnabled: boolean;
  radioUrl?: string | null;
  description: string;
  rules: string;
  category: string;
  creatorId: string;
  creatorName?: string | null;
  creatorImage?: string | null;
  isActive: boolean;
  hasJoined?: boolean;
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
  type: "text" | "sticker" | "audio" | "image" | "poll" | "system";
  body?: string | null;
  replyToMessageId?: string | null;
  stickerId?: string | null;
  audioId?: string | null;
  imageUploadId?: string | null;
  pollId?: string | null;
  isPinned: boolean;
  deletedAt?: string | null;
  createdAt: string;
  authorName?: string | null;
  authorImage?: string | null;
  authorRole?: "admin" | "participant" | null;
  stickerName?: string | null;
  stickerUrl?: string | null;
  stickerOriginalCreatorId?: string | null;
  stickerOriginalCreatorName?: string | null;
  stickerOriginalCreatedAt?: string | null;
  audioUrl?: string | null;
  audioDuration?: number | null;
  imageUrl?: string | null;
  imageName?: string | null;
  imageMimeType?: string | null;
  poll?: Poll | null;
  likes?: number;
};

export type PollOption = {
  id: string;
  pollId: string;
  body: string;
  sortOrder: number;
  createdAt: string;
  votes: number;
  votedByMe: boolean;
};

export type Poll = {
  id: string;
  roomId: string;
  creatorId?: string | null;
  question: string;
  allowsMultiple: boolean;
  closesAt?: string | null;
  createdAt: string;
  totalVotes: number;
  options: PollOption[];
};

export type Sticker = {
  id: string;
  packId: string;
  uploadId: string;
  originalCreatorId?: string | null;
  originalCreatorName?: string | null;
  originalCreatedAt?: string | null;
  sourceStickerId?: string | null;
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

export type RoomMessageRankingItem = {
  userId: string;
  name?: string | null;
  image?: string | null;
  messageCount: number;
};

export type RoomPayload = {
  room: Room;
  participant: Participant | null;
  contents: RoomContent[];
  playback: PlaybackState;
  participants: Participant[];
  messages: ChatMessage[];
  pinnedMessages: ChatMessage[];
  messageCount: number;
  messageRanking: RoomMessageRankingItem[];
  messageRetentionDays?: number | null;
};
