import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Disc3, KeyRound, LockKeyhole, Mail, UserPlus } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Mode = "login" | "register" | "reset";

const modeCopy = {
  login: {
    icon: LockKeyhole,
    title: "Entrar",
    description: "Acesse seus grupos, raves e conversas.",
    action: "Entrar"
  },
  register: {
    icon: UserPlus,
    title: "Criar conta",
    description: "Comece com nome, email e senha.",
    action: "Criar conta"
  },
  reset: {
    icon: KeyRound,
    title: "Recuperar senha",
    description: "Enviaremos um link para seu email.",
    action: "Enviar link"
  }
} satisfies Record<Mode, { icon: typeof LockKeyhole; title: string; description: string; action: string }>;

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
  const copy = modeCopy[mode];
  const ModeIcon = copy.icon;

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setPassword("");
  };

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
        setSuccess("Link de recuperacao enviado.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha inesperada");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-svh bg-[#0d1117] text-white">
      <header className="border-b border-pink-200/10 bg-[#10141b]">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-center px-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#f9a8d4] text-[#24101b] shadow-[0_0_32px_rgba(249,168,212,0.24)]">
              <Disc3 className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-black leading-none text-[#fff1f8]">Haru Space</h1>
          </div>
        </div>
      </header>

      <main className="flex min-h-[calc(100svh-5rem)] w-full items-start justify-center px-4 pb-10 pt-16 sm:pt-20">
        <div className="w-full max-w-[360px]">
          <Card className="border-pink-200/10 bg-[#151a22] shadow-2xl">
            <CardContent className="p-4 pt-4">
              {mode !== "reset" ? (
                <div className="mb-4 grid grid-cols-2 rounded-lg bg-black/20 p-1">
                  <ModeTab active={mode === "login"} onClick={() => changeMode("login")}>
                    Entrar
                  </ModeTab>
                  <ModeTab active={mode === "register"} onClick={() => changeMode("register")}>
                    Criar
                  </ModeTab>
                </div>
              ) : (
                <button
                  type="button"
                  className="mb-5 text-sm font-semibold text-[#f9a8d4] hover:text-[#fbcfe8]"
                  onClick={() => changeMode("login")}
                >
                  Voltar ao login
                </button>
              )}

              <div className="mb-5 flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-pink-200/10 text-[#f9a8d4]">
                  <ModeIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-black leading-tight text-[#fff7fb]">{copy.title}</h2>
                  <p className="mt-1 text-sm text-[#b9c0ca]">{copy.description}</p>
                </div>
              </div>

              <form className="space-y-3" onSubmit={submit}>
                {mode === "register" && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-[#b9c0ca]">Nome</span>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      minLength={2}
                      autoComplete="name"
                      className="h-10 border-pink-200/10 bg-[#202631] focus:border-[#f9a8d4] focus:ring-[#f9a8d4]/20"
                    />
                  </label>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[#b9c0ca]">Email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b9c0ca]" />
                    <Input
                      className="h-10 border-pink-200/10 bg-[#202631] pl-9 focus:border-[#f9a8d4] focus:ring-[#f9a8d4]/20"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      autoComplete="email"
                      inputMode="email"
                    />
                  </div>
                </label>

                {mode !== "reset" && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-[#b9c0ca]">Senha</span>
                    <Input
                      className="h-10 border-pink-200/10 bg-[#202631] focus:border-[#f9a8d4] focus:ring-[#f9a8d4]/20"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={8}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                    />
                  </label>
                )}

                {error && (
                  <p className="rounded-lg border border-red-400/[0.20] bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="rounded-lg border border-emerald-400/[0.20] bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                    {success}
                  </p>
                )}

                <Button
                  className="h-10 w-full bg-[#f9a8d4] text-[#24101b] shadow-[0_0_32px_rgba(249,168,212,0.22)] hover:bg-[#fbcfe8]"
                  type="submit"
                  disabled={pending}
                >
                  {pending ? "Processando" : copy.action}
                </Button>
              </form>

              <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                {mode === "login" && (
                  <>
                    <button
                      type="button"
                      className="font-semibold text-[#f9a8d4] hover:text-[#fbcfe8]"
                      onClick={() => changeMode("register")}
                    >
                      Criar conta
                    </button>
                    <button
                      type="button"
                      className="text-[#b9c0ca] hover:text-white"
                      onClick={() => changeMode("reset")}
                    >
                      Esqueci a senha
                    </button>
                  </>
                )}
                {mode === "register" && (
                  <button
                    type="button"
                    className="mx-auto font-semibold text-[#f9a8d4] hover:text-[#fbcfe8]"
                    onClick={() => changeMode("login")}
                  >
                    Ja tenho conta
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "h-9 rounded-md text-sm font-bold transition",
        active
          ? "bg-[#f9a8d4] text-[#24101b] shadow-sm"
          : "text-[#b9c0ca] hover:bg-white/[0.06] hover:text-white"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
