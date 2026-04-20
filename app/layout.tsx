import type { Metadata } from "next";
import "./globals.css";
import { FocusModeBar } from "@/components/focus/focus-mode-bar";
import { FocusLayoutShell } from "@/components/focus/focus-layout-shell";
import { FocusProvider } from "@/components/focus/focus-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

export const metadata: Metadata = {
  title: "Campus Life OS",
  description: "A polished student dashboard foundation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-[#010102] text-white antialiased">
        <FocusProvider>
          <div className="pointer-events-none fixed inset-0">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,#050506_0%,#020203_24%,#010102_100%)]" />
            <div className="absolute inset-0 system-grain" />
            <div className="absolute inset-x-[-20rem] top-[-18rem] h-[32rem] system-radial-light opacity-60" />
            <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.024),transparent_48%)]" />
            <div className="absolute inset-y-0 right-0 w-[28rem] bg-[linear-gradient(270deg,rgba(255,255,255,0.025),transparent_62%)] opacity-20" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
          </div>

          <FocusLayoutShell
            sidebar={<Sidebar />}
            header={<Header />}
            bottomNav={<MobileBottomNav />}
          >
            {children}
          </FocusLayoutShell>
          <FocusModeBar />
        </FocusProvider>
      </body>
    </html>
  );
}
