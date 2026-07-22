import { Navigate, Outlet, useLocation } from "react-router-dom";
import { authClient } from "@/lib/auth-client";

export function ProtectedRoute() {
  const location = useLocation();
  const session = authClient.useSession();

  if (session.isPending) {
    return (
      <div className="app-surface grid min-h-screen place-items-center">
        <div className="glass-panel rounded-lg p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-end justify-center gap-1">
            {[0, 1, 2, 3].map((item) => (
              <span
                key={item}
                className="w-2 rounded-sm bg-primary animate-pulsebar"
                style={{ animationDelay: `${item * 110}ms` }}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Sincronizando sessão</p>
        </div>
      </div>
    );
  }

  if (!session.data) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
