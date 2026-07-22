import * as React from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Ban,
  Copy,
  Disc3,
  Plus,
  RefreshCcw,
  Save,
  Shield,
  Trash2,
  UserCog,
  UsersRound
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
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

type RoomForm = {
  name: string;
  description: string;
  category: string;
  bannerUrl: string;
};

const blankRoom: RoomForm = {
  name: "",
  description: "",
  category: "Psytrance",
  bannerUrl: ""
};

export function AdminPage() {
  const { data: me } = useMe();
  const [form, setForm] = React.useState<RoomForm>(blankRoom);
  const [editing, setEditing] = React.useState<Room | null>(null);
  const [retention, setRetention] = React.useState(30);
  const [copied, setCopied] = React.useState("");
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
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        bannerUrl: bannerUrl.length > 0 ? bannerUrl : null
      };
      if (editing) {
        return api(`/admin/rooms/${editing.id}`, { method: "PATCH", json: payload });
      }
      return api("/admin/rooms", { method: "POST", json: payload });
    },
    onSuccess: () => {
      setForm(blankRoom);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    }
  });

  const canSaveRoom =
    form.name.trim().length >= 2 &&
    form.category.trim().length >= 2 &&
    form.description.trim().length >= 8 &&
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
    setForm({
      name: room.name,
      description: room.description,
      category: room.category,
      bannerUrl: room.bannerUrl ?? ""
    });
  };

  const copyLink = async (slug: string) => {
    const link = `${window.location.origin}/sala/${slug}`;
    await navigator.clipboard.writeText(link);
    setCopied(slug);
    setTimeout(() => setCopied(""), 1400);
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
              <CardDescription>O link exclusivo é gerado automaticamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Nome da sala" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <Input
                placeholder="Categoria"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
              <Input
                placeholder="URL do banner opcional"
                type="url"
                value={form.bannerUrl}
                onChange={(event) => setForm({ ...form, bannerUrl: event.target.value })}
              />
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
                  {editing ? "Salvar" : "Criar"}
                </Button>
                {editing && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditing(null);
                      setForm(blankRoom);
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
