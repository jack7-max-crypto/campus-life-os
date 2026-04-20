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
    <aside className="hidden border-b border-white/[0.05] bg-[#010102]/98 px-4 py-5 lg:block lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="mb-9">
        <p className="system-label text-white/52">Campus Life OS</p>
        <p className="mt-2 text-sm text-white/42">Student command center</p>
      </div>

      <nav className="grid gap-1.5">
        {navItems.map((item) => {
          const isActive = isCurrentPath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-[14px] border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "border-white/[0.08] bg-[#09090a] text-white shadow-[0_12px_28px_rgba(0,0,0,0.34)]"
                  : "border-transparent text-white/52 hover:-translate-y-[1px] hover:border-white/[0.08] hover:bg-[#070708] hover:text-white/78"
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
