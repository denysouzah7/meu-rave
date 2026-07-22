import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/layouts/AppShell";
import { AdminPage } from "@/pages/AdminPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { RoomPage } from "@/pages/RoomPage";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/admin", element: <AdminPage /> },
          { path: "/perfil", element: <ProfilePage /> },
          { path: "/sala/:slug", element: <RoomPage /> }
        ]
      }
    ]
  }
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
