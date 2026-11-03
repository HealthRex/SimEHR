import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SimEHR",
  description: "Simulated EHR for computer-use agent benchmarking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
