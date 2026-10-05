import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
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
  title: "Mothertongue - Practice Yoruba, Igbo, and Hausa",
  description:
    "Practice Yoruba, Igbo, and Hausa through everyday conversations with an AI partner.",
  keywords: [
    "Yoruba",
    "Igbo",
    "Hausa",
    "language learning",
    "Nigerian",
    "speaking practice",
    "AI",
    "Groq",
  ],
  authors: [{ name: "Mothertongue Team" }],
  openGraph: {
    title: "Mothertongue - Practice Yoruba, Igbo, and Hausa",
    description:
      "Practice Yoruba, Igbo, and Hausa through everyday conversations with an AI partner.",
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
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
          ? <ClerkProvider>{children}</ClerkProvider>
          : children}
      </body>
    </html>
  );
}
