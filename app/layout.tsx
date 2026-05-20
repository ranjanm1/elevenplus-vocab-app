import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import { AuthProvider } from "@/components/AuthProvider";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "11+ Succeed Tuition Centre",
    template: "%s | 11+ Succeed",
  },
  description:
    "11+ tuition centre homepage with access to the vocabulary platform, student quiz, and learning resources.",
  openGraph: {
    title: "11+ Succeed Tuition Centre",
    description:
      "11+ tuition centre homepage with access to the vocabulary platform, student quiz, and learning resources.",
    url: "/",
    siteName: "11+ Succeed",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "11+ Succeed Tuition Centre",
    description:
      "11+ tuition centre homepage with access to the vocabulary platform, student quiz, and learning resources.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <Header />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
