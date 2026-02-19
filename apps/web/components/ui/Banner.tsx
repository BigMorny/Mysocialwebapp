import { PropsWithChildren } from "react";

type Kind = "info" | "warning" | "error";
const styles: Record<Kind, string> = {
  info: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  error: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
};

export function Banner({ kind = "info", children, className = "" }: PropsWithChildren<{ kind?: Kind; className?: string }>) {
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles[kind]} ${className}`}>{children}</div>;
}
