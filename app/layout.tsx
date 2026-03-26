import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

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
      <body className="min-h-full bg-slate-100 text-slate-900 antialiased">
        <div className="min-h-screen lg:flex">
          <Sidebar />
          <div className="flex min-h-screen flex-1 flex-col">
            <Header />
            <main className="flex-1 p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
