import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DrawSpace — Collaborative Whiteboard",
  description:
    "A production-grade collaborative whiteboard for teams. Draw, brainstorm, and collaborate in real-time with infinite canvas, shape tools, and CRDT-powered sync.",
  keywords: [
    "whiteboard",
    "collaborative",
    "drawing",
    "canvas",
    "real-time",
    "excalidraw",
    "team",
    "brainstorm",
  ],
  authors: [{ name: "DrawSpace" }],
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "DrawSpace — Collaborative Whiteboard",
    description: "Draw, brainstorm, and collaborate in real-time.",
    type: "website",
    images: [
      {
        url: "/seo-image.png",
        width: 1200,
        height: 630,
        alt: "DrawSpace — Collaborative Whiteboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DrawSpace — Collaborative Whiteboard",
    description: "Draw, brainstorm, and collaborate in real-time with infinite canvas.",
    images: ["/seo-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(inter.variable, jetbrainsMono.variable)}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
