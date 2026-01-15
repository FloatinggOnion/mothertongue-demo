import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Mothertongue - Speak Yoruba with Confidence",
  description:
    "Practice speaking Yoruba with an AI partner who understands Nigerian culture. Real conversations, no judgment, just progress.",
  keywords: [
    "Yoruba",
    "language learning",
    "Nigerian",
    "speaking practice",
    "AI",
    "Gemini",
  ],
  authors: [{ name: "Mothertongue Team" }],
  openGraph: {
    title: "Mothertongue - Speak Yoruba with Confidence",
    description:
      "Practice speaking Yoruba with an AI partner who understands Nigerian culture.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased font-sans`}>
        {children}
      </body>
    </html>
  );
}
