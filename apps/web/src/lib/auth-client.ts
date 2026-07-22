import { createAuthClient } from "better-auth/react";
import { API_URL } from "@/services/api";

export const authClient = createAuthClient({
  baseURL: API_URL
});
