import type { Metadata, Viewport } from "next";
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
  applicationName: "Campus Life OS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Campus OS",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#020203",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-black text-white antialiased">
        <FocusProvider>
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute inset-0 system-background-field" />
            <div className="absolute inset-0 system-ambient-glow-field" />
            <div className="absolute inset-0 system-directional-light" />
            <div className="absolute inset-0 system-grain opacity-[0.025]" />
            <div className="absolute inset-0 system-atmosphere-layer" />
            <div className="absolute inset-x-[-16rem] top-[-15rem] h-[26rem] system-radial-light opacity-[0.12]" />
            <div className="absolute inset-x-[-10rem] top-[6.25rem] h-16 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.026)_28%,rgba(128,112,216,0.012)_46%,transparent_72%)] blur-md" />
            <div className="absolute inset-x-[-10rem] top-[6.8rem] h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.11)_26%,rgba(180,184,194,0.045)_48%,transparent_74%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,transparent_0%,transparent_32%,rgba(0,0,0,0.18)_58%,rgba(0,0,0,0.62)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_82%_82%,transparent_0%,rgba(0,0,0,0.32)_46%,rgba(0,0,0,0.74)_100%)]" />
          </div>

          <FocusLayoutShell
            sidebar={<Sidebar />}
            header={<Header />}
          >
            {children}
          </FocusLayoutShell>
          <FocusModeBar />
        </FocusProvider>
        <MobileBottomNav />
      </body>
    </html>
  );
}
