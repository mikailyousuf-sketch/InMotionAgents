import "./globals.css";
import { Manrope, Space_Grotesk } from "next/font/google";
import { NavigationProgress } from "@/components/NavigationProgress";
import { SmoothCursor } from "@/components/SmoothCursor";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap"
});

export const metadata = {
  title: "InMotion Agents",
  description: "AI reception, sales and booking agents for businesses"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${spaceGrotesk.variable}`}>
      <body>
        <NavigationProgress />
        <SmoothCursor />
        {children}
      </body>
    </html>
  );
}
