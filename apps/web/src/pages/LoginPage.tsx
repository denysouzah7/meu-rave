import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Disc3, LockKeyhole, Mail, UserPlus, Waves } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Mode = "login" | "register" | "reset";

export function LoginPage() {
  const [mode, setMode] = React.useState<Mode>("login");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const target = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "login") {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message ?? "Login invalido");
        navigate(target, { replace: true });
      } else if (mode === "register") {
        const result = await authClient.signUp.email({ name, email, password });
        if (result.error) throw new Error(result.error.message ?? "Cadastro invalido");
        navigate("/", { replace: true });
      } else {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (result.error) throw new Error(result.error.message ?? "Nao foi possivel enviar recuperacao");
        setSuccess("Link de recuperacao enviado. Em desenvolvimento, veja o console da API.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha inesperada");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="app-surface scanline grid min-h-screen place-items-center px-4 py-8">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-center">
          <div className="mb-7 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow">
              <Disc3 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black">Meu Rave</p>
              <p className="text-sm text-muted-foreground">Comunidade, som e transmissão sincronizada.</p>
            </div>
          </div>

          <div className="max-w-2xl">
            <Badge variant="secondary" className="mb-4">
              Dark mode por padrão
            </Badge>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl">
              Salas privadas para assistir, conversar e moderar sua rave online.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Watch party sincronizada, chat em tempo real, figurinhas, audios, permissões por sala e painel
              administrativo em uma experiência leve.
            </p>
          </div>

          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            {[
              ["Socket.IO", "tempo real"],
              ["SQLite", "leve e local"],
              ["Fastify", "rápido"]
            ].map(([title, text]) => (
              <div key={title} className="rounded-lg border border-white/10 bg-white/[0.045] p-3">
                <p className="text-sm font-bold">{title}</p>
                <p className="text-xs text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="glass-panel animate-slide-up">
          <CardHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-white/[0.08] text-primary">
              {mode === "register" ? <UserPlus className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
            </div>
            <CardTitle>
              {mode === "login" && "Entrar na comunidade"}
              {mode === "register" && "Criar sua conta"}
              {mode === "reset" && "Recuperar senha"}
            </CardTitle>
            <CardDescription>
              {mode === "reset"
                ? "Informe seu email para receber o link de recuperacao."
                : "Acesso protegido para salas, chat e transmissões."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submit}>
              {mode === "register" && (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-muted-foreground">Nome</span>
                  <Input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Email</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              </label>
              {mode !== "reset" && (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-muted-foreground">Senha</span>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                  />
                </label>
              )}

              {error && <p className="rounded-lg border border-red-400/[0.20] bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
              {success && (
                <p className="rounded-lg border border-emerald-400/[0.20] bg-emerald-500/10 p-3 text-sm text-emerald-200">
                  {success}
                </p>
              )}

              <Button className="w-full" type="submit" disabled={pending}>
                <Waves className="h-4 w-4" />
                {pending
                  ? "Processando"
                  : mode === "login"
                    ? "Entrar"
                    : mode === "register"
                      ? "Cadastrar"
                      : "Enviar link"}
              </Button>
            </form>

            <div className="mt-5 grid gap-2 text-center text-sm text-muted-foreground">
              {mode !== "login" && (
                <button type="button" className="font-semibold text-primary" onClick={() => setMode("login")}>
                  Já tenho conta
                </button>
              )}
              {mode !== "register" && (
                <button type="button" className="font-semibold text-primary" onClick={() => setMode("register")}>
                  Criar conta
                </button>
              )}
              {mode !== "reset" && (
                <button type="button" className="font-semibold text-muted-foreground hover:text-foreground" onClick={() => setMode("reset")}>
                  Esqueci minha senha
                </button>
              )}
              <Link to="/" className="sr-only">
                Voltar
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
