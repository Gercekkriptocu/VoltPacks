"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function ResponseLogger() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const logResponse = async () => {
      try {
        const requestId = document
          .querySelector('meta[name="x-request-id"]')
          ?.getAttribute("content");

        if (!requestId) return;

        let responseStatus = 200;

        if (window.__NEXT_DATA__?.props?.pageProps?.statusCode) {
          responseStatus = window.__NEXT_DATA__.props.pageProps.statusCode;
        } else if (document.title.includes("404") || pathname === "/404") {
          responseStatus = 404;
        } else if (document.title.includes("500") || pathname === "/500") {
          responseStatus = 500;
        }

        await fetch("/api/logger", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            level: "info",
            response: {
              url: window.location.href,
              status: responseStatus,
              pathname,
              requestId,
              timestamp: new Date().toISOString(),
            },
          }),
        });
      } catch (error) {
        try {
          await fetch("/api/logger", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              level: "error",
              error: (error as Error).message,
            }),
          });
        } catch (error) {
          console.error("Failed to log response:", error);
        }
      }
    };

    const timer = setTimeout(() => {
      logResponse();
    }, 100);

    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  return null;
}
