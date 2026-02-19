import { PropsWithChildren } from "react";

type Props = PropsWithChildren<{ className?: string }>;

export function Card({ className = "", children }: Props) {
  return <section className={`panel p-4 sm:p-5 ${className}`}>{children}</section>;
}
