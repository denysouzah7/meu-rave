import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold", {
  variants: {
    variant: {
      default: "bg-primary/[0.16] text-primary",
      secondary: "bg-secondary/[0.16] text-pink-200",
      amber: "bg-accent/[0.18] text-amber-200",
      muted: "bg-white/[0.08] text-muted-foreground",
      destructive: "bg-destructive/16 text-red-200"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
