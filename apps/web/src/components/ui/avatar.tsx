import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type AvatarProps = {
  src?: string | null | undefined;
  name?: string | null | undefined;
  className?: string;
};

export function Avatar({ src, name, className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.08] text-sm font-bold text-white",
        className
      )}
    >
      {src ? (
        <img src={src} alt={name ?? "Avatar"} className="h-full w-full object-cover" />
      ) : name ? (
        name.slice(0, 2).toUpperCase()
      ) : (
        <UserRound className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}
