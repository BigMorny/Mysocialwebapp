import Link from "next/link";
import { PropsWithChildren, ReactNode } from "react";
import { Store } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: PropsWithChildren<{ title: string; subtitle: string; footer?: ReactNode }>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <Store className="h-4 w-4 text-brand-400" />
          <span className="font-semibold">MySocial</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
        <div className="mt-6 space-y-4">{children}</div>
        {footer && <div className="mt-5 text-sm text-slate-700 dark:text-slate-300">{footer}</div>}
      </section>
    </main>
  );
}
