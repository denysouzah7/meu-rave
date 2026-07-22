import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRoutes } from "@/routes/AppRoutes";
import { RadioPlayerProvider } from "@/contexts/RadioPlayerContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false
    }
  }
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RadioPlayerProvider>
        <AppRoutes />
      </RadioPlayerProvider>
    </QueryClientProvider>
  );
}
