import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import Motion from "@/components/Motion";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import Offline from "@/components/Offline";
import Pulse from "@/components/Pulse";
import AuthProvider from "@/components/AuthProvider";
import ConferencesProvider from "@/components/ConferencesContext";
import { getSummaries } from "@/lib/data";
import { themeBootScript } from "@/lib/theme";

export const revalidate = 60;

import "./globals.css";
import "./motion.css";

// Before the first paint: if this browser holds a login, say so, so the top bar doesn't flash "Log In" while it checks.
const authHint = `try{for(var i=0;i<localStorage.length;i++){if(/^sb-.+-auth-token$/.test(localStorage.key(i)||"")){document.documentElement.dataset.auth="in";break}}}catch(e){}`;
// Fonts are downloaded at build time and served from collex.au, so visitors never contact Google.
const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Collex · Model UN in Sydney",
  description: "A calendar of Model United Nations conferences in Sydney, each with its own page, plus guides and tools for delegates, chairs and organisers.",
  metadataBase: new URL("https://collex.au"),
  openGraph: { siteName: "Collex", locale: "en_AU", type: "website" },
  twitter: { card: "summary_large_image" },
};

// The colour of the phone's address bar, to match the page in each theme.
export const viewport: Viewport = {
  // The site always shows its light theme, so the address bar matches it whatever the device is set to.
  themeColor: "#f6f3ee",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const list = await getSummaries();
  return (
    <html lang="en-AU" data-theme="light" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: authHint }} />
      </head>
      <body>
        <a href="#top" className="skip">Skip to content</a>
        <AuthProvider>
          <ConferencesProvider list={list}>
            <Motion />
            <Offline />
            <Pulse />
            <TopBar />
            {children}
            <Footer />
          </ConferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
