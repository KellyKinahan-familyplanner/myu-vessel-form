import type { Metadata, Viewport } from "next";
import "@fontsource/rubik/latin-400.css";
import "@fontsource/rubik/latin-600.css";
import "@fontsource/rubik/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vessel walkthrough | Myachts Unlimited",
  description: "Private seller form",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e2a3c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
