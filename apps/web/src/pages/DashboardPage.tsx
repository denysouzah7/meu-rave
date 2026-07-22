import * as React from "react";
import { Link } from "react-router-dom";
import { Calendar, Disc3, Plus, Search, Shield, Sparkles, UsersRound } from "lucide-react";
import { useMe, useRooms } from "@/hooks/useApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";

export function DashboardPage() {
  const [search, setSearch] = React.useState("");
  const { data: me } = useMe();
  const { data, isLoading } = useRooms();
  const rooms = data?.rooms ?? [];
  const filtered = rooms.filter((room) => {
    const value = `${room.name} ${room.category} ${room.description}`.toLowerCase();
    return value.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Badge variant="amber" className="mb-3">
            Comunidades ao vivo
          </Badge>
          <h1 className="max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
            Escolha uma sala e entre no mesmo tempo da transmissão.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Salas com chat em tempo real, participantes online, figurinhas, audios e permissões por evento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {me?.user.role === "admin" && (
            <Button asChild>
              <Link to="/admin">
                <Plus className="h-4 w-4" />
                Criar sala
              </Link>
            </Button>
          )}
          {me?.user.role === "admin" && (
            <Button asChild variant="outline">
              <Link to="/admin">
                <Shield className="h-4 w-4" />
                Painel
              </Link>
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, categoria ou descricao"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-center text-xs text-muted-foreground">
          <div>
            <p className="text-base font-black text-foreground">{rooms.length}</p>
            salas
          </div>
          <div>
            <p className="text-base font-black text-primary">{rooms.filter((room) => room.isActive).length}</p>
            ativas
          </div>
          <div>
            <p className="text-base font-black text-secondary">{new Set(rooms.map((room) => room.category)).size}</p>
            estilos
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-64 animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Disc3 className="h-5 w-5" />}
          title="Nenhuma sala encontrada"
          description="Quando um administrador criar salas, elas aparecem aqui com seus links compartilhaveis."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((room) => (
            <Card key={room.id} className="group overflow-hidden transition hover:border-primary/[0.40] hover:shadow-glow">
              <div className="relative aspect-[16/8] bg-white/[0.05]">
                {room.bannerUrl ? (
                  <img src={room.bannerUrl} alt={room.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,rgba(20,184,166,.24),rgba(236,72,153,.16),rgba(245,158,11,.14))]">
                    <Disc3 className="h-12 w-12 text-white/80" />
                  </div>
                )}
                <div className="absolute left-3 top-3 flex gap-2">
                  <Badge>{room.category}</Badge>
                  {!room.isActive && <Badge variant="destructive">Inativa</Badge>}
                </div>
              </div>
              <CardContent className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black">{room.name}</h2>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{room.description}</p>
                  </div>
                  <Avatar src={room.creatorImage} name={room.creatorName} />
                </div>
                <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(room.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <UsersRound className="h-3.5 w-3.5" />
                    link /sala/{room.slug}
                  </span>
                </div>
                <Button asChild className="w-full">
                  <Link to={`/sala/${room.slug}`}>
                    <Sparkles className="h-4 w-4" />
                    Entrar
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
