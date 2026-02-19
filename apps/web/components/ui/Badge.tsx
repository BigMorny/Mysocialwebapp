type Kind = "success" | "warning" | "danger" | "info";

const styles: Record<Kind, string> = {
  success: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30",
  warning: "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30",
  danger: "bg-rose-100 text-rose-800 ring-1 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30",
  info: "bg-sky-100 text-sky-800 ring-1 ring-sky-300 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-500/30",
};

export function Badge({ kind = "info", children }: { kind?: Kind; children: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[kind]}`}>{children}</span>;
}
