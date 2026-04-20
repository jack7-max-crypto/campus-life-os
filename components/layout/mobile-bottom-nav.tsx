"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/components/layout/nav-items";

function isCurrentPath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.05] bg-[#010102]/98 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
        {navItems.map((item) => {
          const isActive = isCurrentPath(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-[18px] px-1.5 py-2 text-center transition-all duration-200 ${
                isActive
                  ? "border border-white/[0.08] bg-[#09090a] text-white shadow-[0_12px_28px_rgba(0,0,0,0.34)]"
                  : "border border-transparent text-white/42 hover:-translate-y-[1px] hover:border-white/[0.08] hover:bg-[#070708] hover:text-white/72"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
