import { KeyboardEvent, ReactNode } from "react";

export { Card, MetricRow } from "./card/index";

type GenericCardProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export default function GenericCard({
  children,
  className = "",
  onClick,
}: GenericCardProps) {
  const isClickable = Boolean(onClick);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    onClick();
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`
        system-panel system-card-interactive
        relative overflow-hidden
        rounded-[24px]
        transition-all duration-300 ease-out
        p-3.5 sm:p-4
        ${isClickable ? "cursor-pointer focus-visible:outline-none" : ""}
        ${className}
      `}
    >
      <div className="relative">{children}</div>
    </div>
  );
}
