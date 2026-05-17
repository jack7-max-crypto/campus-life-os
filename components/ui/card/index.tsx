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
      className={`system-panel system-card-shell system-card-interactive relative min-w-0 overflow-hidden p-2.5 transition-all duration-300 ease-out sm:p-4 md:p-5 ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/28 via-50% to-transparent" />
      <div className="pointer-events-none absolute inset-y-6 left-0 w-px bg-gradient-to-b from-transparent via-white/12 to-transparent" />

      <div className="relative mb-1.5 flex items-start justify-between gap-3 sm:mb-3 md:mb-4">
        <div>
          {subtitle ? (
            <p
              className={`system-label ${isDark ? "" : ""}`}
            >
              {subtitle}
            </p>
          ) : null}
          <h3
            className={`mt-0.5 text-[0.86rem] font-bold tracking-normal sm:mt-2 sm:text-[15px] ${
              isDark ? "text-white" : "text-white"
            }`}
          >
            {title}
          </h3>
        </div>
      </div>
      <div className="relative space-y-1.5 sm:space-y-3">{children}</div>
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
      className={`system-stat-tile system-card-interactive flex min-w-0 items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 transition-all duration-300 ease-out hover:-translate-y-[1px] hover:border-white/[0.16] sm:px-3 sm:py-2 ${
        isDark
          ? ""
          : ""
      }`}
    >
      <span
        className={`min-w-0 truncate text-sm ${
          isDark
            ? "system-label"
            : "system-label"
        }`}
      >
        {label}
      </span>
      <span className={`min-w-0 max-w-[45%] truncate text-right font-mono text-sm font-bold tracking-[-0.01em] ${isDark ? "text-white" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}
