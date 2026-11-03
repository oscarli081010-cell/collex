import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import Motion from "@/components/Motion";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import AuthProvider from "@/components/AuthProvider";
import ConferencesProvider from "@/components/ConferencesContext";
import { getPublished } from "@/lib/data";
import { themeBootScript } from "@/lib/theme";

export const revalidate = 60;
import "./globals.css";
import "./motion.css";

// Fonts are downloaded at build time and served from collex.au, so visitors never contact Google.
const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Collex · The Sydney MUN calendar",
  description: "A calendar of Model United Nations conferences in Sydney, each with its own page.",
  metadataBase: new URL("https://collex.au"),
  openGraph: { siteName: "Collex", locale: "en_AU", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const list = await getPublished();
  return (
    <html lang="en-AU" data-theme="light" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <a href="#top" className="skip">Skip to content</a>
        <AuthProvider>
          <ConferencesProvider list={list}>
            <Motion />
            <TopBar />
            {children}
            <Footer />
          </ConferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
