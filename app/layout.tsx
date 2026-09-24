import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "UlasanToko — Kartu Google Review",
  description: "Aktivasi kartu Google Review"
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="id"><body>{children}</body></html>;
}