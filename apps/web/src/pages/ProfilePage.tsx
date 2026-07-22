import * as React from "react";
import { Camera, KeyRound, LogOut, Save, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { api, uploadFile } from "@/services/api";
import { useMe, useInvalidate } from "@/hooks/useApi";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ProfilePage() {
  const { data } = useMe();
  const invalidate = useInvalidate();
  const user = data?.user;
  const [name, setName] = React.useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const saveProfile = async () => {
    setError("");
    await api("/me", { method: "PATCH", json: { name } });
    invalidate(["me"]);
    setMessage("Perfil atualizado.");
  };

  const updateAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    await uploadFile("avatar", file);
    invalidate(["me"]);
    setMessage("Foto atualizada.");
  };

  const changePassword = async () => {
    setError("");
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true
    });
    if (result.error) {
      setError(result.error.message ?? "Nao foi possivel alterar a senha");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setMessage("Senha alterada.");
  };

  const signOut = async () => {
    await authClient.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section>
        <Badge variant={user?.role === "admin" ? "secondary" : "default"} className="mb-3">
          {user?.role === "admin" ? "Administrador" : "Participante"}
        </Badge>
        <h1 className="text-3xl font-black">Perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">Atualize sua presença nas salas e mantenha sua conta segura.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Identidade</CardTitle>
            <CardDescription>Nome e foto aparecem no chat, participantes e moderação.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar src={user?.image} name={user?.name} className="h-20 w-20 text-xl" />
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold transition hover:bg-white/[0.08]">
                <Camera className="h-4 w-4" />
                Foto
                <input type="file" accept="image/*" className="sr-only" onChange={updateAvatar} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Nome</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <Button onClick={saveProfile}>
              <Save className="h-4 w-4" />
              Salvar perfil
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>Troque sua senha e encerre outras sessões ativas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="password"
              placeholder="Senha atual"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <Input
              type="password"
              placeholder="Nova senha"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={changePassword} disabled={!currentPassword || !newPassword}>
                <KeyRound className="h-4 w-4" />
                Alterar senha
              </Button>
              <Button variant="outline" onClick={signOut}>
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {(message || error) && (
        <div className="rounded-lg border border-white/10 bg-white/[0.045] p-3 text-sm">
          {message && <p className="text-emerald-200">{message}</p>}
          {error && <p className="text-red-200">{error}</p>}
        </div>
      )}

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/[0.08] text-primary">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.email}</p>
            <p className="text-xs text-muted-foreground">ID {user?.id}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
