import type { Metadata } from "next";
import Motion from "@/components/Motion";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";
import "./motion.css";

export const metadata: Metadata = {
  title: "Collex · The Sydney MUN calendar",
  description: "Every Model United Nations conference in Sydney, on one calendar, with one standard page each.",
  metadataBase: new URL("https://collex.au"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <Motion />
          <TopBar />
          {children}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
