import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  className
}: {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("grid min-h-40 place-items-center rounded-lg border border-dashed border-white/[0.12] p-6 text-center", className)}>
      <div>
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-white/[0.08] text-primary">
          {icon}
        </div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
