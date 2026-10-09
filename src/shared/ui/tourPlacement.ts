// ST2-D: the tips tour. Which controls it points at, in order, and where its speech bubble goes
// beside the one it points at. Pure: no React Native or Expo imports.

export const TOUR_STEPS = ['profile', 'menu', 'relay', 'routes', 'locate', 'search', 'checkin', 'ride', 'crowdsource'] as const;
export type TourStepId = (typeof TOUR_STEPS)[number];

export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };

export type BubblePlacement = {
  left: number;
  top: number;
  // The bubble sits below the control (arrow on its top edge) or above it (arrow on its bottom edge)
  below: boolean;
  // Where the arrow's tip is, from the bubble's left edge, so it points at the control's centre
  arrowLeft: number;
};

const HALF = 2;

// The bubble goes on the side of the control with more room (below a control in the top half of
// the screen, above one in the bottom half), `gap` away from it, kept `margin` inside the screen.
// The arrow stays `arrowInset` clear of the bubble's rounded corners.
export function placeBubble(target: Rect, screen: Size, bubble: Size, gap: number, margin: number, arrowInset: number): BubblePlacement {
  const centreX = target.x + target.width / HALF;
  const below = target.y + target.height / HALF < screen.height / HALF;
  const maxLeft = Math.max(margin, screen.width - margin - bubble.width);
  const left = Math.min(Math.max(centreX - bubble.width / HALF, margin), maxLeft);
  const top = below ? target.y + target.height + gap : target.y - gap - bubble.height;
  const arrowLeft = Math.min(Math.max(centreX - left, arrowInset), Math.max(arrowInset, bubble.width - arrowInset));
  return { left, top: Math.min(Math.max(top, margin), Math.max(margin, screen.height - margin - bubble.height)), below, arrowLeft };
}
