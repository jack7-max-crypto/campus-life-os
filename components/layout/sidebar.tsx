"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Academics", href: "/academics" },
  { label: "Planner", href: "/planner" },
  { label: "Fitness", href: "/fitness" },
  { label: "Money", href: "/money" },
  { label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-slate-200 bg-white px-4 py-4 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="mb-5 lg:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Campus Life OS</p>
        <p className="mt-1 text-sm text-slate-500">Student command center</p>
      </div>

      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
