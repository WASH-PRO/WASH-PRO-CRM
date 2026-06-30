import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "block w-full rounded-md border-0 bg-input px-3 py-2 text-sm text-foreground",
        "ring-1 ring-inset ring-ring-line placeholder:text-faint",
        "focus:ring-2 focus:ring-inset focus:ring-cyan-400/50",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "block w-full rounded-md border-0 bg-input px-3 py-2 text-sm text-foreground",
        "ring-1 ring-inset ring-ring-line focus:ring-2 focus:ring-inset focus:ring-cyan-400/50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "block w-full rounded-md border-0 bg-input px-3 py-2 text-sm text-foreground",
        "ring-1 ring-inset ring-ring-line placeholder:text-faint",
        "focus:ring-2 focus:ring-inset focus:ring-cyan-400/50",
        className,
      )}
      {...props}
    />
  );
}

export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground-secondary">
      {children}
    </label>
  );
}

export function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}>{children}</div>;
}
