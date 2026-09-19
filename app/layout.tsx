import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import "./globals.css";

// Inter includes Cyrillic glyphs, needed for the Russian UI.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Uniview — see your future university",
  description:
    "Real, verified photos of university campuses, dorms, lecture halls, libraries and cities, with a source for every photo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
