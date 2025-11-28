import type { Metadata } from "next";
import React from "react";
import localFont from "next/font/local";
import "./globals.css";
import { ResponseLogger } from "@/components/response-logger";
import { cookies } from "next/headers";
import { ReadyNotifier } from "@/components/ready-notifier";
import FarcasterWrapper from "@/components/FarcasterWrapper";
import { AppKitProvider, config } from "@/providers";
import { cookieToInitialState } from "wagmi";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const requestId = cookieStore.get("x-request-id")?.value;
  
  // Wagmi initial state from cookies for proper SSR hydration
  const initialState = cookieToInitialState(config, cookieStore.toString());

  return (
        <html lang="en">
          <head>
            {requestId && <meta name="x-request-id" content={requestId} />}
            <script src="https://w.soundcloud.com/player/api.js" async></script>
          </head>
          <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          >
            {/* Do not remove this component, we use it to notify the parent that the mini-app is ready */}
            <ReadyNotifier />
            <AppKitProvider initialState={initialState}>
              <FarcasterWrapper>
                {children}
              </FarcasterWrapper>
            </AppKitProvider>
            <ResponseLogger />
          </body>
        </html>
      );
}

export const metadata: Metadata = {
        title: "Stranger Packs",
        description: "Unlock mysterious Stranger cards with our mini app. Mint and reveal exciting cards. Collect them all!",
        other: { "fc:frame": JSON.stringify({"version":"next","imageUrl":"https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/thumbnail_cmihf4duu000104juh3z0hfop-i9FnEStl755F3M3RjvUn223MbWUzn3","button":{"title":"Open with Ohara","action":{"type":"launch_frame","name":"Stranger Packs","url":"https://saddle-possible-632.app.ohara.ai","splashImageUrl":"https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/farcaster/splash_images/splash_image1.svg","splashBackgroundColor":"#ffffff"}}}
        ) }
    };
