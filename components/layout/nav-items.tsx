import type { ComponentType, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function HomeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path d="M3 10.75 12 3l9 7.75" />
      <path d="M5.5 9.5V21h13V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

function AcademicsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" />
      <path d="M7 9.8v4.6c0 1.3 2.24 2.6 5 2.6s5-1.3 5-2.6V9.8" />
      <path d="M20 9v5" />
    </svg>
  );
}

function PlannerIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <rect x="4.5" y="5.5" width="15" height="14" rx="2.5" />
      <path d="M8 3.5v4" />
      <path d="M16 3.5v4" />
      <path d="M4.5 10.5h15" />
      <path d="m9 14 1.5 1.5L15 11" />
    </svg>
  );
}

function FitnessIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path d="m6 9 2-2" />
      <path d="m16 15 2-2" />
      <path d="m4.5 10.5 3-3 6 6-3 3Z" />
      <path d="m10.5 16.5 3-3 6 6-3 3Z" />
      <path d="m9 15-3 3" />
      <path d="m15 9 3-3" />
    </svg>
  );
}

function MoneyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.75" />
      <path d="M7 12h.01" />
      <path d="M17 12h.01" />
    </svg>
  );
}

function SettingsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.25" />
      <path d="M12 18.25v2.25" />
      <path d="m18.01 5.99-1.6 1.6" />
      <path d="m7.59 16.41-1.6 1.6" />
      <path d="M20.5 12h-2.25" />
      <path d="M5.75 12H3.5" />
      <path d="m18.01 18.01-1.6-1.6" />
      <path d="m7.59 7.59-1.6-1.6" />
    </svg>
  );
}

export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<IconProps>;
};

export const navItems: NavItem[] = [
  { label: "Home", href: "/", icon: HomeIcon },
  { label: "Academics", href: "/academics", icon: AcademicsIcon },
  { label: "Planner", href: "/planner", icon: PlannerIcon },
  { label: "Fitness", href: "/fitness", icon: FitnessIcon },
  { label: "Money", href: "/money", icon: MoneyIcon },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];
