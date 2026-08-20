import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { ServiceWorkerRegistration } from "@/components/layout/service-worker";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const DESCRIPTION =
  "Consent-based attendance and activity verification for couples and friends. Live camera proof, genuine location, and sharing you control.";

export const metadata: Metadata = {
  // Without this, the generated opengraph-image resolves to a relative URL
  // and link previews come out blank.
  metadataBase: new URL(APP_URL),
  title: {
    default: "LoveTrack",
    template: "%s · LoveTrack",
  },
  description: DESCRIPTION,
  applicationName: "LoveTrack",
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    siteName: "LoveTrack",
    title: "LoveTrack",
    description: DESCRIPTION,
    url: APP_URL,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "LoveTrack",
    description: DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: "LoveTrack",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

// Mobile-first: fill the viewport edge-to-edge on notched phones and keep
// pinch-zoom available (never disable it — that breaks accessibility).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF8FB" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0810" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // next-themes injects an inline script that sets the theme before first
  // paint. Without the nonce the CSP blocks it, and the page flashes the
  // wrong theme on every load — the exact problem that script exists to
  // solve. The proxy puts the nonce here.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          {children}
          <Toaster position="top-center" richColors closeButton />
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}
