import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import '@/features/telegram/telegram.css';
export const metadata: Metadata = {
  title: "Змістовно — CRM школи",
  description: "Простір, де починається змістовне навчання",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body>
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
