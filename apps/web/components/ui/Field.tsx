import { InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes } from "react";

export function Field({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input-base ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input-base ${props.className ?? ""}`} />;
}
