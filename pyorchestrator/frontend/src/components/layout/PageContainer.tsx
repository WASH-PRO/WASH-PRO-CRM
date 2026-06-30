import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/** Shared horizontal padding — keep in sync with PageHeader */
export const PAGE_X = "px-6 lg:px-8";
export const PAGE_Y = "py-6 lg:py-8";

interface PageContainerProps {
  children: ReactNode;
  flush?: boolean;
  className?: string;
}

export default function PageContainer({ children, flush, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full flex-1",
        flush ? "p-0" : cn(PAGE_X, PAGE_Y),
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}

/** Uniform 12-column page grid */
export function PageGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-12", className)}>
      {children}
    </div>
  );
}

const COL_SPAN: Record<number, string> = {
  1: "col-span-full xl:col-span-1",
  2: "col-span-full xl:col-span-2",
  3: "col-span-full md:col-span-1 xl:col-span-3",
  4: "col-span-full md:col-span-1 xl:col-span-4",
  5: "col-span-full md:col-span-1 xl:col-span-5",
  6: "col-span-full md:col-span-2 xl:col-span-6",
  7: "col-span-full md:col-span-2 xl:col-span-7",
  8: "col-span-full md:col-span-2 xl:col-span-8",
  9: "col-span-full md:col-span-2 xl:col-span-9",
  10: "col-span-full md:col-span-2 xl:col-span-10",
  11: "col-span-full md:col-span-2 xl:col-span-11",
  12: "col-span-full md:col-span-2 xl:col-span-12",
};

export function Col({
  children,
  span = 12,
  className,
}: {
  children: ReactNode;
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  className?: string;
}) {
  return <div className={cn("flex min-h-0 flex-col", COL_SPAN[span], className)}>{children}</div>;
}
