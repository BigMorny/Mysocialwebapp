import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
};

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-400",
};

export function Button({ variant = "primary", className = "", loading = false, children, disabled, ...props }: Props) {
  return (
    <button
      className={`btn-base ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Please wait..." : children}
    </button>
  );
}
