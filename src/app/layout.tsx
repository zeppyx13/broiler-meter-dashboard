import "./globals.css";
import { Inter, Poppins, Lora } from "next/font/google";
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

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-lora",
});

export const metadata = {
  title: "Coasther — Smart Broiler Energy Dashboard",
  description: "Dashboard monitoring IoT dan efisiensi energi kandang ayam broiler Coasther — listrik, air, dan kondisi iklim kandang secara real-time.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/coasther.png", type: "image/png" },
    ],
    apple: "/coasther.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${poppins.variable} ${lora.variable}`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}