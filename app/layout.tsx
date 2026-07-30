import type { Metadata } from "next";
import React, { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeShortcut } from "@/components/theme-shortcut";
import { VersionBanner } from "@/components/version-banner";
import { ZarazPageView } from "@/components/zaraz-page-view";
import { ChatCalendarBootstrap } from "@/components/chat-calendar-bootstrap";
import { PageSeoBlock } from "@/components/page-seo-block";
import { TurnstileSiteKeyProvider } from "@/hooks/use-turnstile-site-key";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import {
  CHAT_SEO_DESCRIPTION,
  CHAT_SEO_TITLE,
  SITE_ORIGIN,
} from "@/lib/page-seo";
import { getTurnstileSiteKey } from "@/lib/turnstile-config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: CHAT_SEO_TITLE,
    template: "%s",
  },
  applicationName: "Bila UiTM Cuti Chat",
  other: {
    site_name: "Bila UiTM Cuti Chat",
  },
  description: CHAT_SEO_DESCRIPTION,
  keywords: [
    "UiTM",
    "chat",
    "AI",
    "academic calendar",
    "Bila UiTM Cuti",
    "cuti UiTM",
    "UiTM Assistant",
    "AI Chat UiTM",
    "Bila UiTM Cuti Chat",
  ],
  generator: "Next.js",
  authors: [{ name: "Bila UiTM Cuti", url: SITE_ORIGIN }],
  creator: "Bila UiTM Cuti",
  category: "education",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  alternates: {
    canonical: SITE_ORIGIN,
  },
  openGraph: {
    siteName: "Bila UiTM Cuti Chat",
    title: CHAT_SEO_TITLE,
    description: CHAT_SEO_DESCRIPTION,
    type: "website",
    url: SITE_ORIGIN,
    locale: "ms_MY",
    images: [
      {
        url: `${SITE_ORIGIN}/og/chat.png`,
        width: 1200,
        height: 630,
        alt: CHAT_SEO_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: CHAT_SEO_TITLE,
    description: CHAT_SEO_DESCRIPTION,
    images: [`${SITE_ORIGIN}/og/chat.png`],
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(GeistSans.variable, GeistMono.variable, "font-sans")}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <meta
          name="theme-color"
          content="#ffffff"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#1a1a1a"
          media="(prefers-color-scheme: dark)"
        />
        {getTurnstileSiteKey() ? (
          <link rel="preconnect" href="https://challenges.cloudflare.com" />
        ) : null}
        <meta name="application-name" content="Bila UiTM Cuti Chat" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${SITE_ORIGIN}/#organization`,
                  name: "Bila UiTM Cuti",
                  url: "https://bilauitmcuti.com",
                },
                {
                  "@type": "WebSite",
                  "@id": `${SITE_ORIGIN}/#website`,
                  url: SITE_ORIGIN,
                  name: "Bila UiTM Cuti Chat",
                  description: CHAT_SEO_DESCRIPTION,
                  publisher: { "@id": `${SITE_ORIGIN}/#organization` },
                  inLanguage: ["ms-MY", "en"],
                },
              ],
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'system';
                  function resolveTheme(stored) {
                    if (stored === 'dark' || stored === 'light') return stored;
                    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  var resolvedTheme = resolveTheme(theme);
                  var root = document.documentElement;
                  root.classList.remove('dark', 'light');
                  root.classList.add(resolvedTheme);
                  root.style.colorScheme = resolvedTheme;
                  root.style.backgroundColor = resolvedTheme === 'dark' ? 'oklch(0.145 0 0)' : 'oklch(1 0 0)';
                } catch (e) {
                  document.documentElement.classList.add('light');
                  document.documentElement.style.backgroundColor = 'oklch(1 0 0)';
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${GeistSans.className} antialiased`} suppressHydrationWarning>
        <VersionBanner />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem={true}
          storageKey="theme"
          disableTransitionOnChange={true}
        >
          <ThemeShortcut />
          <TurnstileSiteKeyProvider initialSiteKey={getTurnstileSiteKey()}>
            <PageSeoBlock
              heading={CHAT_SEO_TITLE}
              description={CHAT_SEO_DESCRIPTION}
              url={SITE_ORIGIN}
              breadcrumbs={[{ name: "Chat", item: SITE_ORIGIN }]}
            />
            <ChatCalendarBootstrap />
            {children}
          </TurnstileSiteKeyProvider>
        </ThemeProvider>
        <Suspense fallback={null}>
          <ZarazPageView />
        </Suspense>
      </body>
    </html>
  );
}
