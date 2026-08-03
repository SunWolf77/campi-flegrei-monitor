/**
 * Shared viewport breakpoints (match Tailwind defaults).
 * Use for layout logic — not only CSS classes.
 */

export const BP = {
  /** phone */
  sm: 640,
  /** tablet / large phone landscape */
  md: 768,
  /** laptop */
  lg: 1024,
  /** desktop */
  xl: 1280,
} as const;

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl";

export type ViewportState = {
  width: number;
  height: number;
  /** short side ≤ 500 or width < md */
  isMobile: boolean;
  /** width < lg */
  isTablet: boolean;
  /** width ≥ lg */
  isDesktop: boolean;
  /** landscape and short height (phone landscape / small laptop) */
  isShort: boolean;
  /** visualViewport height when available (mobile browser chrome) */
  vvHeight: number;
  bp: Breakpoint;
};

export function classifyWidth(w: number): Breakpoint {
  if (w >= BP.xl) return "xl";
  if (w >= BP.lg) return "lg";
  if (w >= BP.md) return "md";
  if (w >= BP.sm) return "sm";
  return "xs";
}

export function readViewport(): ViewportState {
  if (typeof window === "undefined") {
    return {
      width: 1280,
      height: 800,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isShort: false,
      vvHeight: 800,
      bp: "xl",
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const vvHeight = window.visualViewport?.height ?? height;
  const bp = classifyWidth(width);
  const isMobile = width < BP.md;
  const isTablet = width >= BP.md && width < BP.lg;
  const isDesktop = width >= BP.lg;
  // Short: limited vertical room for map (landscape phone or short window)
  const isShort = vvHeight < 560 || (height < 500 && width > height);
  return { width, height, isMobile, isTablet, isDesktop, isShort, vvHeight, bp };
}

/** Prefer collapsed chrome when map needs vertical room. */
export function preferCollapsedChrome(v: ViewportState, tabIsMap: boolean): boolean {
  if (!tabIsMap) return false;
  return v.isMobile || v.isShort;
}
