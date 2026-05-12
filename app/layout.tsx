import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WorkforceProvider } from "@/app/components/WorkforceProvider";
import { StoresProvider } from "@/app/components/StoresProvider";
import { SettingsProvider } from "@/app/components/SettingsProvider";
import { AlertsProvider } from "@/app/components/AlertsProvider";
import { RequestsProvider } from "@/app/components/RequestsProvider";
import { InvitesProvider } from "@/app/components/InvitesProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shiftly",
  description: "Shift planning dashboard UI prototype",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="no"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F3F6FB] text-slate-900">
        <StoresProvider>
          <WorkforceProvider>
            <SettingsProvider>
              <RequestsProvider>
                <InvitesProvider>
                  <AlertsProvider>{children}</AlertsProvider>
                </InvitesProvider>
              </RequestsProvider>
            </SettingsProvider>
          </WorkforceProvider>
        </StoresProvider>
      </body>
    </html>
  );
}
