import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaSupport from "./pwa-support";

export const metadata: Metadata = {
  title: "Repbook — Your work, recorded.",
  description: "Your private workout and nutrition journal. Every session, every set, every step forward.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Repbook" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#101010", viewportFit: "cover" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><PwaSupport />{children}</body></html>;
}
