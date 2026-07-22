import * as React from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Ban,
  Copy,
  Disc3,
  ImagePlus,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCcw,
  Save,
  Shield,
  Trash2,
  UserCog,
  UsersRound
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, resolveMediaUrl, uploadFile } from "@/services/api";
import type { Room, User } from "@/services/types";
import { useMe, useRooms } from "@/hooks/useApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type RoomForm = {
  name: string;
  slug: string;
  type: "rave" | "group";
  description: string;
  category: string;
  bannerUrl: string;
  coverUrl: string;
  backgroundUrl: string;
};

const blankRoom: RoomForm = {
  name: "",
  slug: "",
  type: "rave",
  description: "",
  category: "Psytrance",
  bannerUrl: "",
  coverUrl: "",
  backgroundUrl: ""
};

function previewRoomSlug(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "link-personalizado"
  );
}

export function AdminPage() {
  const { data: me } = useMe();
  const [form, setForm] = React.useState<RoomForm>(blankRoom);
  const [editing, setEditing] = React.useState<Room | null>(null);
  const [retention, setRetention] = React.useState(30);
  const [copied, setCopied] = React.useState("");
  const [bannerUploading, setBannerUploading] = React.useState(false);
  const [bannerError, setBannerError] = React.useState("");
  const [coverUploading, setCoverUploading] = React.useState(false);
  const [coverError, setCoverError] = React.useState("");
  const [backgroundUploading, setBackgroundUploading] = React.useState(false);
  const [backgroundError, setBackgroundError] = React.useState("");
  const bannerInputRef = React.useRef<HTMLInputElement | null>(null);
  const coverInputRef = React.useRef<HTMLInputElement | null>(null);
  const backgroundInputRef = React.useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const { data: roomsData } = useRooms();

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api<{ users: User[] }>("/admin/users"),
    enabled: me?.user.role === "admin"
  });

  const settingsQuery = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api<{ settings: { messageRetentionDays: number } }>("/admin/settings"),
    enabled: me?.user.role === "admin"
  });

  React.useEffect(() => {
    if (settingsQuery.data?.settings.messageRetentionDays) {
      setRetention(settingsQuery.data.settings.messageRetentionDays);
    }
  }, [settingsQuery.data?.settings.messageRetentionDays]);

  const saveRoom = useMutation({
    mutationFn: () => {
      const bannerUrl = form.bannerUrl.trim();
      const coverUrl = form.type === "group" ? form.coverUrl.trim() : "";
      const backgroundUrl = form.backgroundUrl.trim();
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        type: form.type,
        description: form.description.trim(),
        category: form.category.trim(),
        bannerUrl: bannerUrl.length > 0 ? bannerUrl : null,
        coverUrl: coverUrl.length > 0 ? coverUrl : null,
        backgroundUrl: backgroundUrl.length > 0 ? backgroundUrl : null
      };
      if (editing) {
        return api(`/admin/rooms/${editing.id}`, { method: "PATCH", json: payload });
      }
      return api("/admin/rooms", { method: "POST", json: payload });
    },
    onSuccess: () => {
      setForm(blankRoom);
      setEditing(null);
      setBannerError("");
      setCoverError("");
      setBackgroundError("");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    }
  });

  const canSaveRoom =
    form.name.trim().length >= 2 &&
    form.category.trim().length >= 2 &&
    form.description.trim().length >= 8 &&
    !bannerUploading &&
    !coverUploading &&
    !backgroundUploading &&
    !saveRoom.isPending;

  const saveRetention = useMutation({
    mutationFn: () => api("/admin/settings", { method: "PATCH", json: { messageRetentionDays: retention } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "settings"] })
  });

  if (me && me.user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const rooms = roomsData?.rooms ?? [];
  const users = usersQuery.data?.users ?? [];

  const editRoom = (room: Room) => {
    setEditing(room);
    setBannerError("");
    setCoverError("");
    setBackgroundError("");
    setForm({
      name: room.name,
      slug: room.slug,
      type: room.type ?? "rave",
      description: room.description,
      category: room.category,
      bannerUrl: room.bannerUrl ?? "",
      coverUrl: room.coverUrl ?? "",
      backgroundUrl: room.backgroundUrl ?? ""
    });
  };

  const copyLink = async (slug: string) => {
    const link = `${window.location.origin}/sala/${slug}`;
    await navigator.clipboard.writeText(link);
    setCopied(slug);
    setTimeout(() => setCopied(""), 1400);
  };

  const uploadBanner = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBannerUploading(true);
    setBannerError("");

    try {
      const result = await uploadFile("image", file);
      setForm((current) => ({ ...current, bannerUrl: result.upload.url }));
    } catch (error) {
      setBannerError(error instanceof Error ? error.message : "Nao foi possivel enviar a imagem.");
    } finally {
      setBannerUploading(false);
    }
  };

  const uploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setCoverUploading(true);
    setCoverError("");

    try {
      const result = await uploadFile("image", file);
      setForm((current) => ({ ...current, coverUrl: result.upload.url }));
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : "Nao foi possivel enviar a contra capa.");
    } finally {
      setCoverUploading(false);
    }
  };

  const uploadBackground = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBackgroundUploading(true);
    setBackgroundError("");

    try {
      const result = await uploadFile("image", file);
      setForm((current) => ({ ...current, backgroundUrl: result.upload.url }));
    } catch (error) {
      setBackgroundError(error instanceof Error ? error.message : "Nao foi possivel enviar o fundo.");
    } finally {
      setBackgroundUploading(false);
    }
  };

  const patchUser = async (id: string, patch: "role" | "block" | "remove", user?: User) => {
    if (patch === "role") {
      await api(`/admin/users/${id}/role`, {
        method: "PATCH",
        json: { role: user?.role === "admin" ? "participant" : "admin" }
      });
    } else if (patch === "block") {
      await api(`/admin/users/${id}/block`, {
        method: "PATCH",
        json: { isBlocked: !user?.isBlocked, blockedReason: user?.isBlocked ? undefined : "Bloqueado pelo admin" }
      });
    } else {
      await api(`/admin/users/${id}`, { method: "DELETE" });
    }
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="secondary" className="mb-3">
            Painel protegido
          </Badge>
          <h1 className="text-3xl font-black">Administração</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie salas, usuários, permissões globais e limpeza automática.</p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
          <RefreshCcw className="h-4 w-4" />
          Atualizar
        </Button>
      </section>

      <Tabs defaultValue="rooms" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-[520px]">
          <TabsTrigger value="rooms">Salas</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="settings">Ajustes</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>{editing ? "Editar sala" : "Criar sala"}</CardTitle>
              <CardDescription>Escolha um link bonito ou deixe o sistema sugerir pelo nome.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={form.type === "rave" ? "default" : "outline"}
                  className="justify-start"
                  onClick={() =>
                    setForm({ ...form, type: "rave", category: form.category || "Psytrance", coverUrl: "" })
                  }
                >
                  <Disc3 className="h-4 w-4" />
                  Rave
                </Button>
                <Button
                  type="button"
                  variant={form.type === "group" ? "default" : "outline"}
                  className="justify-start"
                  onClick={() =>
                    setForm({
                      ...form,
                      type: "group",
                      category: form.category === "Psytrance" ? "Geral" : form.category
                    })
                  }
                >
                  <MessageCircle className="h-4 w-4" />
                  Grupo
                </Button>
              </div>
              <Input placeholder="Nome da sala" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Link personalizado</span>
                <div className="flex overflow-hidden rounded-lg border border-white/[0.12] bg-white/[0.04] focus-within:ring-2 focus-within:ring-ring">
                  <span className="flex shrink-0 items-center border-r border-white/10 px-3 text-sm text-muted-foreground">
                    /sala/
                  </span>
                  <input
                    value={form.slug}
                    onChange={(event) => setForm({ ...form, slug: previewRoomSlug(event.target.value) })}
                    placeholder={previewRoomSlug(form.name)}
                    className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <span className="mt-1 block truncate text-xs text-primary">
                  {window.location.origin}/sala/{previewRoomSlug(form.slug || form.name)}
                </span>
              </label>
              <Input
                placeholder="Categoria"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
              <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                <input ref={bannerInputRef} type="file" accept="image/*" className="sr-only" onChange={uploadBanner} />
                <div
                  className={cn(
                    "relative bg-white/[0.04]",
                    form.type === "group"
                      ? "flex h-36 items-center justify-center bg-[radial-gradient(circle_at_center,rgba(236,72,153,.18),rgba(255,255,255,.04)_55%,transparent_74%)]"
                      : "aspect-[16/7]"
                  )}
                >
                  {form.bannerUrl ? (
                    <img
                      src={resolveMediaUrl(form.bannerUrl)}
                      alt={form.name || (form.type === "group" ? "Foto do grupo" : "Capa da rave")}
                      className={cn(
                        "object-cover",
                        form.type === "group" ? "h-24 w-24 rounded-full border-2 border-primary/35 shadow-xl" : "h-full w-full"
                      )}
                    />
                  ) : (
                    <button
                      type="button"
                      className={cn(
                        "flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground",
                        form.type === "group" && "mx-auto h-24 w-24 rounded-full border-2 border-dashed border-primary/30"
                      )}
                      onClick={() => bannerInputRef.current?.click()}
                    >
                      <ImagePlus className="h-8 w-8" />
                      <span className="text-sm font-semibold">
                        {form.type === "group" ? "Foto do grupo" : "Capa da rave"}
                      </span>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {form.type === "group" ? "Foto redonda do grupo" : "Imagem da rave"}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={bannerUploading}
                      onClick={() => bannerInputRef.current?.click()}
                    >
                      {bannerUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      {bannerUploading ? "Enviando" : form.bannerUrl ? "Trocar" : "Enviar"}
                    </Button>
                    {form.bannerUrl && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={bannerUploading}
                        onClick={() => setForm({ ...form, bannerUrl: "" })}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {bannerError && (
                <p className="rounded-lg border border-red-400/[0.20] bg-red-500/[0.10] p-3 text-sm text-red-100">
                  {bannerError}
                </p>
              )}
              {form.type === "group" && (
                <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                  <input ref={coverInputRef} type="file" accept="image/*" className="sr-only" onChange={uploadCover} />
                  <div className="relative aspect-[16/6] bg-white/[0.04]">
                    {form.coverUrl ? (
                      <img
                        src={resolveMediaUrl(form.coverUrl)}
                        alt="Contra capa do grupo"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 room-wallpaper bg-[linear-gradient(135deg,rgba(236,72,153,.20),rgba(20,184,166,.12),rgba(255,255,255,.04))]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/20" />
                    <button
                      type="button"
                      className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-2 text-white transition hover:bg-black/15"
                      onClick={() => coverInputRef.current?.click()}
                    >
                      <ImagePlus className="h-8 w-8" />
                      <span className="text-sm font-semibold">
                        {form.coverUrl ? "Trocar contra capa" : "Enviar contra capa"}
                      </span>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Banner atras da foto do grupo
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={coverUploading}
                        onClick={() => coverInputRef.current?.click()}
                      >
                        {coverUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        {coverUploading ? "Enviando" : form.coverUrl ? "Trocar" : "Enviar"}
                      </Button>
                      {form.coverUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={coverUploading}
                          onClick={() => setForm({ ...form, coverUrl: "" })}
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {form.type === "group" && coverError && (
                <p className="rounded-lg border border-red-400/[0.20] bg-red-500/[0.10] p-3 text-sm text-red-100">
                  {coverError}
                </p>
              )}
              <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                <input
                  ref={backgroundInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={uploadBackground}
                />
                <div className="relative aspect-[16/9] room-wallpaper">
                  {form.backgroundUrl && (
                    <img
                      src={resolveMediaUrl(form.backgroundUrl)}
                      alt="Fundo do chat"
                      className="h-full w-full object-cover opacity-75"
                    />
                  )}
                  <button
                    type="button"
                    className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-2 bg-black/35 text-white transition hover:bg-black/25"
                    onClick={() => backgroundInputRef.current?.click()}
                  >
                    <ImagePlus className="h-8 w-8" />
                    <span className="text-sm font-semibold">
                      {form.backgroundUrl ? "Trocar fundo do chat" : "Enviar fundo do chat"}
                    </span>
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Fundo usado dentro do chat {form.type === "group" ? "do grupo" : "da rave"}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={backgroundUploading}
                      onClick={() => backgroundInputRef.current?.click()}
                    >
                      {backgroundUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      {backgroundUploading ? "Enviando" : form.backgroundUrl ? "Trocar" : "Enviar"}
                    </Button>
                    {form.backgroundUrl && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={backgroundUploading}
                        onClick={() => setForm({ ...form, backgroundUrl: "" })}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {backgroundError && (
                <p className="rounded-lg border border-red-400/[0.20] bg-red-500/[0.10] p-3 text-sm text-red-100">
                  {backgroundError}
                </p>
              )}
              <Textarea
                placeholder="Descricao da sala"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
              {form.description.trim().length > 0 && form.description.trim().length < 8 && (
                <p className="rounded-lg border border-amber-400/[0.20] bg-amber-500/[0.10] p-3 text-sm text-amber-100">
                  A descrição precisa ter pelo menos 8 caracteres.
                </p>
              )}
              {saveRoom.error && (
                <p className="rounded-lg border border-red-400/[0.20] bg-red-500/[0.10] p-3 text-sm text-red-100">
                  {saveRoom.error instanceof Error ? saveRoom.error.message : "Nao foi possivel salvar a sala."}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => saveRoom.mutate()} disabled={!canSaveRoom}>
                  {editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {editing ? "Salvar" : form.type === "group" ? "Criar grupo" : "Criar rave"}
                </Button>
                {editing && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditing(null);
                      setForm(blankRoom);
                      setBannerError("");
                      setCoverError("");
                      setBackgroundError("");
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {rooms.length === 0 ? (
              <EmptyState icon={<Disc3 className="h-5 w-5" />} title="Sem salas" description="Crie a primeira sala para gerar um link compartilhável." />
            ) : (
              rooms.map((room) => (
                <Card key={room.id}>
                  <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-black">{room.name}</h2>
                        <Badge variant={room.type === "group" ? "secondary" : "default"}>
                          {room.type === "group" ? "Grupo" : "Rave"}
                        </Badge>
                        <Badge>{room.category}</Badge>
                        {!room.isActive && <Badge variant="destructive">Inativa</Badge>}
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{room.description}</p>
                      <p className="mt-2 text-xs text-primary">/sala/{room.slug}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button variant="outline" size="sm" onClick={() => copyLink(room.slug)}>
                        <Copy className="h-4 w-4" />
                        {copied === room.slug ? "Copiado" : "Link"}
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/sala/${room.slug}`}>Abrir</Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => editRoom(room)}>
                        Editar
                      </Button>
                      <Button
                        variant={room.isActive ? "destructive" : "secondary"}
                        size="sm"
                        onClick={async () => {
                          await api(`/admin/rooms/${room.id}`, { method: "PATCH", json: { isActive: !room.isActive } });
                          queryClient.invalidateQueries({ queryKey: ["rooms"] });
                        }}
                      >
                        {room.isActive ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        aria-label="Excluir sala"
                        onClick={async () => {
                          await api(`/admin/rooms/${room.id}`, { method: "DELETE" });
                          queryClient.invalidateQueries({ queryKey: ["rooms"] });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="users" className="grid gap-3">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={user.image} name={user.name} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{user.name}</p>
                      <Badge variant={user.role === "admin" ? "secondary" : "muted"}>{user.role === "admin" ? "Admin" : "Participante"}</Badge>
                      {user.isBlocked && <Badge variant="destructive">Bloqueado</Badge>}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button variant="outline" size="sm" onClick={() => patchUser(user.id, "role", user)}>
                    <Shield className="h-4 w-4" />
                    {user.role === "admin" ? "Remover admin" : "Definir admin"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => patchUser(user.id, "block", user)}>
                    <Ban className="h-4 w-4" />
                    {user.isBlocked ? "Liberar" : "Bloquear"}
                  </Button>
                  <Button variant="destructive" size="icon" aria-label="Remover usuário" onClick={() => patchUser(user.id, "remove")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {users.length === 0 && (
            <EmptyState icon={<UsersRound className="h-5 w-5" />} title="Sem usuários" description="Cadastros aparecem aqui para gestão administrativa." />
          )}
        </TabsContent>

        <TabsContent value="settings">
          <Card className="max-w-xl glass-panel">
            <CardHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-white/[0.08] text-primary">
                <UserCog className="h-5 w-5" />
              </div>
              <CardTitle>Retenção do chat</CardTitle>
              <CardDescription>Mensagens antigas são removidas automaticamente pelo backend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Dias para manter mensagens</span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={retention}
                  onChange={(event) => setRetention(Number(event.target.value))}
                />
              </label>
              <Button onClick={() => saveRetention.mutate()} disabled={saveRetention.isPending}>
                <Save className="h-4 w-4" />
                Salvar ajuste
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
