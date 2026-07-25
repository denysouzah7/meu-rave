import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Disc3, Home, LogOut, Music, Shield, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useMe } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { GlobalRadioDock } from "@/components/radio/GlobalRadioDock";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Salas", icon: Home },
  { to: "/musica", label: "Música", icon: Music },
  { to: "/perfil", label: "Perfil", icon: UserRound }
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data } = useMe();
  const user = data?.user;
  const isRoomRoute = location.pathname.startsWith("/sala/");

  const signOut = async () => {
    await authClient.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className={cn("app-surface min-h-screen", isRoomRoute && "max-sm:h-[100dvh] max-sm:min-h-0 max-sm:overflow-hidden lg:h-screen lg:min-h-0 lg:overflow-hidden")}>
      <div
        className={cn(
          "mx-auto flex min-h-screen w-full max-w-[1500px] flex-col lg:flex-row",
          isRoomRoute && "max-sm:h-full max-sm:min-h-0 max-sm:overflow-hidden lg:h-full lg:min-h-0 lg:overflow-hidden"
        )}
      >
        <aside className="hidden w-[260px] shrink-0 border-r border-white/10 bg-black/[0.18] px-4 py-5 backdrop-blur-xl lg:block">
          <Link to="/" className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow">
              <Disc3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-black">Haru Space</p>
              <p className="text-xs text-muted-foreground">Comunidade em tempo real</p>
            </div>
          </Link>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground",
                    isActive && "bg-white/10 text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
            {user?.role === "admin" && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground",
                    isActive && "bg-white/10 text-foreground"
                  )
                }
              >
                <Shield className="h-4 w-4" />
                Admin
              </NavLink>
            )}
          </nav>

          <div className="mt-auto pt-8">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center gap-3">
                <Avatar src={user?.image} name={user?.name} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user?.name ?? "Usuario"}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-3 w-full justify-start" onClick={signOut}>
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        </aside>

        {!isRoomRoute && (
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
            <Link to="/" className="flex items-center gap-2 font-black">
              <Disc3 className="h-5 w-5 text-primary" />
              Haru Space
            </Link>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" asChild aria-label="Perfil">
                <Link to="/perfil">
                  <Avatar src={user?.image} name={user?.name} className="h-8 w-8" />
                </Link>
              </Button>
            </div>
          </header>
        )}

        <main
          className={cn(
            "min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8",
            isRoomRoute && "max-sm:h-full max-sm:min-h-0 max-sm:overflow-hidden max-sm:p-0 lg:h-full lg:min-h-0 lg:overflow-hidden lg:p-0"
          )}
        >
          <Outlet />
        </main>
      </div>
      {!isRoomRoute && <GlobalRadioDock />}
    </div>
  );
}
