import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { defaultLocale, getDictionary } from "@/lib/i18n/dictionaries";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vivi — AI recruiting with video interviews",
  description:
    "Build vacancies in an AI chat, share one link with candidates, and collect video interviews in one place.",
};

// Sets the theme class on <html> before paint (no flash). Picks the storage
// key by area: /app uses "vivi-app", everything else uses "vivi-public".
const THEME_INIT_SCRIPT = `(function(){try{var k=location.pathname.indexOf('/app')===0?'vivi-app':'vivi-public';var t=localStorage.getItem(k)==='light'?'light':'dark';var c=document.documentElement.classList;c.remove('light','dark');c.add(t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const dict = getDictionary();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers locale={defaultLocale} dict={dict}>
          {children}
        </Providers>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
