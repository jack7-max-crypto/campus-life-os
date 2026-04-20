import { ReactNode } from "react";

type CardProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
  variant?: "default" | "dark";
};

export function Card({
  title,
  subtitle,
  children,
  className = "",
  variant = "default",
}: CardProps) {
  const isDark = variant === "dark";

  return (
    <section
      className={`system-panel system-card-interactive relative overflow-hidden rounded-[24px] p-4 transition-all duration-300 ease-out md:p-5 ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

      <div className="relative mb-3 flex items-start justify-between gap-3 md:mb-4">
        <div>
          {subtitle ? (
            <p
              className={`system-label ${isDark ? "" : ""}`}
            >
              {subtitle}
            </p>
          ) : null}
          <h3
            className={`mt-2 text-[15px] font-semibold tracking-[-0.01em] ${
              isDark ? "text-white" : "text-white"
            }`}
          >
            {title}
          </h3>
        </div>
      </div>
      <div className="relative space-y-3">{children}</div>
    </section>
  );
}

export function MetricRow({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "dark";
}) {
  const isDark = variant === "dark";

  return (
    <div
      className={`system-subtle-panel system-card-interactive flex items-center justify-between rounded-xl border border-white/[0.05] bg-black/40 px-3 py-2 transition-all duration-300 ease-out hover:-translate-y-[1px] hover:border-white/[0.12] hover:shadow-[0_12px_40px_rgba(0,0,0,0.75)] ${
        isDark
          ? ""
          : ""
      }`}
    >
      <span
        className={`text-sm ${
          isDark
            ? "system-label"
            : "system-label"
        }`}
      >
        {label}
      </span>
      <span className={`text-sm font-semibold tracking-[-0.01em] ${isDark ? "text-white" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}
