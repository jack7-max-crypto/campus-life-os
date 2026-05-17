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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="system-side-chrome relative hidden overflow-hidden border-b px-4 py-5 lg:block lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="pointer-events-none absolute inset-0 opacity-[0.055] [background-image:radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.38)_0_0.32px,transparent_0.7px),radial-gradient(circle_at_77%_43%,rgba(205,210,222,0.16)_0_0.4px,transparent_0.86px)] [background-position:0_0,24px_18px] [background-size:170px_140px,260px_210px]" />
      <div className="relative mb-9">
        <p className="system-label">Campus Life OS</p>
        <p className="system-page-copy mt-2 text-sm">Student command center</p>
      </div>

      <nav className="relative grid gap-1.5">
        {navItems.map((item) => {
          const isActive = isCurrentPath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`system-nav-pill rounded-[14px] px-3 py-2.5 text-sm font-semibold ${
                isActive
                  ? "system-nav-pill-active"
                  : ""
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
