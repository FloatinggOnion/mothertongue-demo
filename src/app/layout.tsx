import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
  display: "swap",
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${lora.variable} ${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
