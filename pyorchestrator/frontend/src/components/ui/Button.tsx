import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-cyan-400 text-on-accent shadow-sm hover:bg-cyan-300 focus-visible:outline-cyan-400",
  secondary:
    "bg-chip text-foreground ring-1 ring-inset ring-ring-line hover:bg-hover focus-visible:outline-muted",
  ghost:
    "text-foreground-secondary hover:bg-hover hover:text-foreground focus-visible:outline-muted",
  danger:
    "bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20 hover:bg-red-500/20 focus-visible:outline-red-500",
};

const sizes: Record<Size, string> = {
  sm: "rounded-md px-2.5 py-1.5 text-xs",
  md: "rounded-md px-3 py-2 text-sm",
  lg: "rounded-lg px-4 py-2.5 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-x-1.5 font-semibold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-cyan-400",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
