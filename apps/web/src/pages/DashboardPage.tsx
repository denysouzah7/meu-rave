import * as React from "react";
import { Link } from "react-router-dom";
import { Calendar, Disc3, MessageCircle, Plus, Shield, Sparkles } from "lucide-react";
import { resolveMediaUrl } from "@/services/api";
import { useMe, useRooms } from "@/hooks/useApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate } from "@/lib/utils";

type RoomTab = "rave" | "group";

export function DashboardPage() {
  const [activeTab, setActiveTab] = React.useState<RoomTab>("group");
  const { data: me } = useMe();
  const { data, isLoading } = useRooms();
  const rooms = data?.rooms ?? [];
  const raveRooms = rooms.filter((room) => room.type !== "group");
  const groupRooms = rooms.filter((room) => room.type === "group");
  const activeRooms = activeTab === "group" ? groupRooms : raveRooms;
  const activeLabel = activeTab === "group" ? "grupo" : "rave";
  const emptyIcon = activeTab === "group" ? <MessageCircle className="h-5 w-5" /> : <Disc3 className="h-5 w-5" />;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Badge variant="amber" className="mb-3">
            Comunidades ao vivo
          </Badge>
          <h1 className="max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
            Escolha um grupo ou rave e entre na comunidade.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Haru Space conecta grupos, raves, chat em tempo real, figurinhas, fotos, audios e enquetes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {me?.user.role === "admin" && (
            <Button asChild>
              <Link to="/admin">
                <Plus className="h-4 w-4" />
                Criar
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

      <Tabs
        value={activeTab}
        defaultValue="group"
        onValueChange={(value) => {
          setActiveTab(value as RoomTab);
        }}
        className="space-y-4"
      >
        <div className="border-y border-white/10 py-3">
          <TabsList className="grid w-full grid-cols-2 gap-1 p-1 sm:max-w-md">
            <TabsTrigger value="group" className="flex items-center justify-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Grupos
              <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[11px] text-secondary">
                {groupRooms.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="rave" className="flex items-center justify-center gap-2">
              <Disc3 className="h-4 w-4" />
              Raves
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[11px] text-primary">{raveRooms.length}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-64 animate-pulse border border-white/10 bg-white/[0.05]" />
            ))}
          </div>
        ) : activeRooms.length === 0 ? (
          <EmptyState
            icon={emptyIcon}
            title={`Nenhum ${activeLabel} encontrado`}
            description={`Quando um administrador criar ${
              activeTab === "group" ? "grupos" : "raves"
            }, eles aparecem aqui com seus links compartilhaveis.`}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeRooms.map((room) => (
              <Card
                key={room.id}
                className="group flex h-full flex-col overflow-hidden rounded-none border-white/10 bg-white/[0.035] transition hover:border-primary/[0.40] hover:bg-white/[0.055] hover:shadow-glow"
              >
                <div
                  className={cn(
                    "relative bg-white/[0.05]",
                    room.type === "group"
                      ? "flex h-28 items-center justify-center bg-[radial-gradient(circle_at_center,rgba(236,72,153,.18),rgba(255,255,255,.04)_55%,transparent_72%)]"
                      : "h-24 sm:h-28"
                  )}
                >
                  {room.type === "group" && room.coverUrl && (
                    <>
                      <img
                        src={resolveMediaUrl(room.coverUrl)}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-300 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/25" />
                    </>
                  )}
                  {room.bannerUrl ? (
                    room.type === "group" ? (
                      <img
                        src={resolveMediaUrl(room.bannerUrl)}
                        alt={room.name}
                        className="relative z-10 h-20 w-20 rounded-full border-2 border-primary/35 object-cover shadow-xl transition duration-300 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <img
                        src={resolveMediaUrl(room.bannerUrl)}
                        alt={room.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    )
                  ) : (
                    <div
                      className={cn(
                        "flex items-center justify-center bg-[linear-gradient(135deg,rgba(20,184,166,.20),rgba(236,72,153,.13),rgba(245,158,11,.12))]",
                        room.type === "group"
                          ? "relative z-10 h-20 w-20 rounded-full border-2 border-primary/35"
                          : "h-full w-full"
                      )}
                    >
                      {room.type === "group" ? (
                        <MessageCircle className="h-12 w-12 text-white/80" />
                      ) : (
                        <Disc3 className="h-12 w-12 text-white/80" />
                      )}
                    </div>
                  )}
                  {room.type !== "group" && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
                  )}
                  <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-24px)] flex-wrap gap-2">
                    <Badge>{room.category}</Badge>
                    {!room.isActive && <Badge variant="destructive">Inativa</Badge>}
                  </div>
                </div>
                <CardContent className="flex min-h-[190px] flex-1 flex-col p-4">
                  <div className="min-w-0">
                    <h2 className="line-clamp-1 text-lg font-black leading-tight text-foreground">{room.name}</h2>
                    <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm leading-5 text-muted-foreground">
                      {room.description}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(room.createdAt)}
                    </span>
                  </div>
                  <div className="mt-auto pt-4">
                    <Button asChild className="w-full">
                      <Link to={`/sala/${room.slug}`}>
                        <Sparkles className="h-4 w-4" />
                        {room.type === "group" ? "Abrir grupo" : "Entrar"}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Tabs>
    </div>
  );
}
