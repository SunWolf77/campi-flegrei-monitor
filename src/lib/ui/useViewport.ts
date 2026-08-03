import { useEffect, useState } from "react";
import { readViewport, type ViewportState } from "@/lib/ui/breakpoints";

/** Live viewport + visualViewport (mobile browser URL bar). */
export function useViewport(): ViewportState {
  const [vp, setVp] = useState<ViewportState>(() => readViewport());

  useEffect(() => {
    const update = () => setVp(readViewport());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, []);

  return vp;
}
