import "./globals.css";
import { Inter, Poppins } from "next/font/google";
import QueryProvider from "@/components/providers/query-provider";
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata = {
  title: "Coasther Admin",
  description: "Admin dashboard Coasther",
  icons: {
    icon: "/coasther.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${poppins.variable}`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}