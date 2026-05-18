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
  const mobileNavItems = navItems.filter((item) => item.href !== "/money");

  return (
    <nav className="system-mobile-chrome fixed inset-x-0 bottom-0 z-50 px-1 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.2rem)] lg:hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),rgba(190,194,204,0.045),transparent)]" />
      <div className="relative mx-auto grid w-full max-w-[min(19rem,calc(100vw-0.65rem))] grid-cols-5 gap-0">
        {mobileNavItems.map((item) => {
          const isActive = isCurrentPath(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`system-nav-pill flex min-h-[2.45rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[11px] px-0.5 py-0.5 text-center ${
                isActive
                  ? "system-nav-pill-active"
                  : ""
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span
                className="max-w-full truncate font-mono text-[7.5px] font-bold leading-none"
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
