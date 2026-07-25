import * as React from "react";
import { Camera, Clapperboard, Clock3, Image, Link2, ListVideo, Plus, Power, Trash2, Upload, X } from "lucide-react";
import type { Room, RoomContent, RoomStatus } from "@/services/types";
import { api, resolveMediaUrl, uploadFile } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/lib/utils";

type Props = {
  room: Room;
  contents: RoomContent[];
  activeContentId?: string | null | undefined;
  onReload: () => void;
  onActivate: (contentId: string) => void;
  onEndRoom: () => void;
};

export function RoomAdminPanel({ room, contents, activeContentId, onReload, onActivate, onEndRoom }: Props) {
  const [title, setTitle] = React.useState("");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  // Status
  const [statuses, setStatuses] = React.useState<RoomStatus[]>([]);
  const [statusPending, setStatusPending] = React.useState(false);
  const [statusCaption, setStatusCaption] = React.useState("");
  const [statusUploadId, setStatusUploadId] = React.useState<string | null>(null);
  const [statusType, setStatusType] = React.useState<"image" | "video" | null>(null);
  const imageRef = React.useRef<HTMLInputElement | null>(null);
  const videoRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    api<{ statuses: RoomStatus[] }>(`/rooms/${room.slug}/status`)
      .then((data) => setStatuses(data.statuses))
      .catch(() => {});
  }, [room.slug]);

  const handleStatusUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (type === "video") {
      const duration = await readVideoDuration(file);
      if (duration && duration > 120) {
        alert("Video deve ter no maximo 2 minutos");
        return;
      }
    }
    setStatusPending(true);
    try {
      const result = await uploadFile(type, file);
      setStatusUploadId(result.upload.id);
      setStatusType(type);
    } catch {
      alert("Erro ao fazer upload");
    }
    setStatusPending(false);
  };

  const createStatus = async () => {
    if (!statusUploadId || !statusType) return;
    setStatusPending(true);
    try {
      const data = await api<{ status: RoomStatus }>(`/rooms/${room.slug}/status`, {
        method: "POST",
        json: {
          uploadId: statusUploadId,
          type: statusType,
          caption: statusCaption || undefined,
        },
      });
      setStatuses((prev) => [data.status, ...prev]);
      setStatusUploadId(null);
      setStatusType(null);
      setStatusCaption("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar status");
    }
    setStatusPending(false);
  };

  const deleteStatus = async (statusId: string) => {
    try {
      await api(`/rooms/${room.slug}/status/${statusId}`, { method: "DELETE" });
      setStatuses((prev) => prev.filter((s) => s.id !== statusId));
    } catch {
      alert("Erro ao deletar status");
    }
  };

  const addContent = async () => {
    if (!title || !sourceUrl) return;
    setPending(true);
    const durationSeconds = parseDurationMinutes(durationMinutes);
    await api(`/rooms/${room.id}/contents`, {
      method: "POST",
      json: { title, sourceUrl, durationSeconds },
    });
    setTitle("");
    setSourceUrl("");
    setDurationMinutes("");
    setPending(false);
    onReload();
  };

  const uploadVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPending(true);
    const detectedDuration = await readVideoDuration(file);
    const result = await uploadFile("video", file);
    setTitle(file.name.replace(/\.[a-z0-9]+$/i, ""));
    setSourceUrl(result.upload.url);
    if (detectedDuration) {
      setDurationMinutes(formatMinutesInput(detectedDuration));
    }
    setPending(false);
  };

  return (
    <>
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4 text-primary" />
            Controle da sala
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[360px_1fr_auto]">
          <div className="space-y-2">
            <Input placeholder="Titulo do conteudo" value={title} onChange={(event) => setTitle(event.target.value)} />
            <Input placeholder="YouTube, link direto ou upload" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
            <Input
              placeholder="Duracao em minutos"
              type="number"
              min={0}
              step={0.1}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={addContent} disabled={pending || !title || !sourceUrl}>
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Upload
              </Button>
              <input ref={fileRef} type="file" accept="video/*" className="sr-only" onChange={uploadVideo} />
            </div>
          </div>
          <div className="thin-scrollbar flex gap-2 overflow-x-auto pb-1">
            {contents.map((content) => (
              <button
                key={content.id}
                type="button"
                onClick={() => onActivate(content.id)}
                className={`min-w-56 rounded-lg border p-3 text-left transition ${
                  activeContentId === content.id
                    ? "border-primary bg-primary/[0.12]"
                    : "border-white/10 bg-white/[0.04] hover:border-primary/[0.35]"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <ListVideo className="h-4 w-4 text-primary" />
                  <Badge variant={content.sourceType === "youtube" ? "secondary" : "muted"}>{content.sourceType}</Badge>
                </div>
                <p className="line-clamp-2 text-sm font-semibold">{content.title}</p>
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {content.durationSeconds ? formatDuration(content.durationSeconds) : "Duracao nao definida"}
                </p>
              </button>
            ))}
            {contents.length === 0 && (
              <div className="grid min-h-24 min-w-56 place-items-center rounded-lg border border-dashed border-white/10 text-sm text-muted-foreground">
                <Link2 className="mb-1 h-4 w-4 text-primary" />
                Playlist vazia
              </div>
            )}
          </div>
          <Button variant="destructive" onClick={onEndRoom} disabled={!room.isActive}>
            <Power className="h-4 w-4" />
            Encerrar
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Status / Stories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusUploadId && statusType && (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-3">
              {statusType === "image" ? <Image className="h-5 w-5 text-primary" /> : <Camera className="h-5 w-5 text-primary" />}
              <span className="flex-1 text-sm text-white/80">Midia selecionada ({statusType})</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setStatusUploadId(null); setStatusType(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => imageRef.current?.click()} disabled={statusPending}>
              <Image className="h-4 w-4" />
              Foto
            </Button>
            <Button size="sm" variant="outline" onClick={() => videoRef.current?.click()} disabled={statusPending}>
              <Camera className="h-4 w-4" />
              Video (max 2min)
            </Button>
            <input ref={imageRef} type="file" accept="image/*" className="sr-only" onChange={(e) => handleStatusUpload(e, "image")} />
            <input ref={videoRef} type="file" accept="video/*" className="sr-only" onChange={(e) => handleStatusUpload(e, "video")} />
          </div>
          <Input
            placeholder="Legenda (opcional)"
            value={statusCaption}
            onChange={(event) => setStatusCaption(event.target.value)}
          />
          <Button onClick={createStatus} disabled={!statusUploadId || !statusType || statusPending}>
            <Plus className="h-4 w-4" />
            Publicar Status (24h)
          </Button>

          {statuses.length > 0 && (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-xs font-semibold text-muted-foreground">Status ativos</p>
              {statuses.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  {s.type === "image" ? (
                    <img src={resolveMediaUrl(s.mediaUrl)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <video src={resolveMediaUrl(s.mediaUrl)} className="h-10 w-10 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    {s.caption && <p className="truncate text-sm">{s.caption}</p>}
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-red-400" onClick={() => deleteStatus(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function parseDurationMinutes(value: string) {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
}

function formatMinutesInput(seconds: number) {
  return (seconds / 60).toFixed(2).replace(/\.?0+$/, "");
}

function readVideoDuration(file: File) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}
