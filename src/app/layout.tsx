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
  title: "Coasther — Smart Kandang Broiler",
  description: "Dashboard monitoring inlet tandon dan listrik panel kandang broiler: peringatan dini dan efisiensi energi per siklus.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/coasther.png", type: "image/png" },
    ],
    apple: "/coasther.png",
  },
  appleWebApp: { capable: true, title: "Coasther", statusBarStyle: "default" as const },
};

export const viewport = {
  themeColor: "#7B1113",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.variable} ${poppins.variable}`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
