import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";

import { ThemeProvider } from "@/context/ThemeContext";
import "./globals.css";
import "./study.css";

const inter = Inter({
  variable: "--font-geist-sans", // Keeping variable name same so we don't break existing css
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-geist-mono", // Using outfit for headings/stylish stuff
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Episteme Study",
  description:
    "Next-Gen AI Study App: Instantly turn documents into flashcards and quizzes, backed by custom Knowledge Graphs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
