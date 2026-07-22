import { Ban, Eye, MessageCircle, Mic, ShieldCheck, VolumeX } from "lucide-react";
import type { Participant } from "@/services/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  participants: Participant[];
  canModerate: boolean;
  onPatch: (participantId: string, patch: Partial<Participant>) => void;
};

export function ParticipantsPanel({ participants, canModerate, onPatch }: Props) {
  const online = participants.filter((participant) => participant.online);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          Participantes
          <Badge>{online.length} online</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="thin-scrollbar max-h-[430px] space-y-3 overflow-y-auto">
        {participants.map((participant) => (
          <div key={participant.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center gap-3">
              <span className="relative">
                <Avatar src={participant.image} name={participant.name} />
                <span
                  className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border border-background ${
                    participant.online ? "bg-emerald-400" : "bg-muted"
                  }`}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{participant.name ?? "Participante"}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant={participant.role === "administrator" ? "secondary" : "muted"}>
                    {participant.role === "administrator" ? "Admin" : participant.role}
                  </Badge>
                  {participant.isMuted && <Badge variant="amber">Silenciado</Badge>}
                  {participant.isBanned && <Badge variant="destructive">Banido</Badge>}
                </div>
              </div>
            </div>

            {canModerate && (
              <div className="mt-3 grid grid-cols-6 gap-1">
                <Button
                  variant={participant.canWatch ? "outline" : "destructive"}
                  size="icon"
                  aria-label="Alternar assistir"
                  onClick={() => onPatch(participant.id, { canWatch: !participant.canWatch })}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant={participant.canChat ? "outline" : "destructive"}
                  size="icon"
                  aria-label="Alternar chat"
                  onClick={() => onPatch(participant.id, { canChat: !participant.canChat })}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button
                  variant={participant.canSendAudio ? "outline" : "destructive"}
                  size="icon"
                  aria-label="Alternar audio"
                  onClick={() => onPatch(participant.id, { canSendAudio: !participant.canSendAudio })}
                >
                  <Mic className="h-4 w-4" />
                </Button>
                <Button
                  variant={participant.canModerate ? "secondary" : "outline"}
                  size="icon"
                  aria-label="Alternar moderacao"
                  onClick={() =>
                    onPatch(participant.id, {
                      canModerate: !participant.canModerate,
                      role: participant.canModerate ? "participant" : "moderator"
                    })
                  }
                >
                  <ShieldCheck className="h-4 w-4" />
                </Button>
                <Button
                  variant={participant.isMuted ? "secondary" : "outline"}
                  size="icon"
                  aria-label="Silenciar"
                  onClick={() => onPatch(participant.id, { isMuted: !participant.isMuted })}
                >
                  <VolumeX className="h-4 w-4" />
                </Button>
                <Button
                  variant={participant.isBanned ? "secondary" : "destructive"}
                  size="icon"
                  aria-label="Banir"
                  onClick={() => onPatch(participant.id, { isBanned: !participant.isBanned })}
                >
                  <Ban className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
