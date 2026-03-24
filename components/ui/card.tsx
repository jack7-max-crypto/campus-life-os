import { ReactNode } from "react";

type CardProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
};

export function Card({ title, subtitle, children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/60 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}
