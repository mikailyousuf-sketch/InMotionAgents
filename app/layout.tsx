import "./globals.css";

export const metadata = {
  title: "InMotion Agents",
  description: "AI reception, sales and booking agents for businesses"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
