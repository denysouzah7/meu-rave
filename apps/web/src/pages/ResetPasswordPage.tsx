import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [password, setPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const navigate = useNavigate();
  const token = params.get("token");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("Token invalido ou expirado.");
      return;
    }

    const result = await authClient.resetPassword({ token, newPassword: password });
    if (result.error) {
      setError(result.error.message ?? "Nao foi possivel alterar a senha");
      return;
    }
    setMessage("Senha alterada com sucesso.");
    setTimeout(() => navigate("/login"), 800);
  };

  return (
    <div className="app-surface grid min-h-screen place-items-center px-4">
      <Card className="glass-panel w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/[0.15] text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <CardTitle>Alterar senha</CardTitle>
          <CardDescription>Defina uma nova senha para sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submit}>
            <Input
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nova senha"
            />
            {error && <p className="text-sm text-red-200">{error}</p>}
            {message && <p className="text-sm text-emerald-200">{message}</p>}
            <Button className="w-full" type="submit">
              Salvar senha
            </Button>
          </form>
          <Button asChild variant="ghost" className="mt-3 w-full">
            <Link to="/login">Voltar ao login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
