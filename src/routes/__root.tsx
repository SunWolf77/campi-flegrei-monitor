import type { ReactNode } from "react";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";

/** FOUC-safe theme boot — runs before paint */
const themeBoot = `(function(){try{var k='ses-cf-theme';var m=localStorage.getItem(k)||'dark';var r=m;if(m==='system'){r=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}else if(m!=='light'){r='dark';}var e=document.documentElement;e.classList.toggle('light',r==='light');e.classList.toggle('dark',r==='dark');e.style.colorScheme=r;e.dataset.theme=r;}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: "Campi Flegrei Monitor · Sun-Earth-Sentinel",
      },
      {
        name: "description",
        content:
          "INGV-powered Campi Flegrei seismic and volcano monitoring — depth visualization, swarm analysis, SUPT detective, SES focus node #2 after Tonga–Kermadec.",
      },
      { name: "theme-color", content: "#0b0c0e" },
      { name: "color-scheme", content: "dark light" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
