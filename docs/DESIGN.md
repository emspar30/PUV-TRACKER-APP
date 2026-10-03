---
name: Urban Transit System
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1b1b1c'
  on-surface-variant: '#424654'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0ef'
  outline: '#737785'
  outline-variant: '#c3c6d6'
  surface-tint: '#0856cf'
  primary: '#0041a2'
  on-primary: '#ffffff'
  primary-container: '#0b57d0'
  on-primary-container: '#ced9ff'
  inverse-primary: '#b2c5ff'
  secondary: '#076d2e'
  on-secondary: '#ffffff'
  secondary-container: '#9cf7a7'
  on-secondary-container: '#147434'
  tertiary: '#6c3b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#8e4f00'
  on-tertiary-container: '#ffd0a9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001847'
  on-primary-fixed-variant: '#0040a1'
  secondary-fixed: '#9cf7a7'
  secondary-fixed-dim: '#81da8d'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005320'
  tertiary-fixed: '#ffdcc0'
  tertiary-fixed-dim: '#ffb876'
  on-tertiary-fixed: '#2d1600'
  on-tertiary-fixed-variant: '#6b3b00'
  background: '#fcf9f8'
  on-background: '#1b1b1c'
  surface-variant: '#e5e2e1'
typography:
  headline-lg:
    fontFamily: Roboto Flex
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.5px
  headline-lg-mobile:
    fontFamily: Roboto Flex
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.3px
  headline-md:
    fontFamily: Roboto Flex
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 28px
  headline-sm:
    fontFamily: Roboto Flex
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
  body-lg:
    fontFamily: Roboto Flex
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Roboto Flex
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Roboto Flex
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Roboto Flex
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.1px
  label-md:
    fontFamily: Roboto Flex
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.5px
  label-sm:
    fontFamily: Roboto Flex
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.5px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embraces an authentic Material 3 / Google Maps civic transit aesthetic: utilitarian, hyper-legible, calm, and effortlessly functional. The system caters to daily commuters, multimodal travelers, and city navigators who require instant, split-second readability in bright daylight or chaotic station platforms.

### Design Movements & Tone
- **Material 3 Expressive meets Utilitarian Minimalism**: Interfaces prioritize spatial clarity, content-first sheets, and high contrast without visual clutter.
- **Wayfinding Clarity**: Color serves strictly as information architecture—signaling vehicle paths, live vehicle location, delay status, and occupancy tiers.
- **Airy Tactility**: Generous tapping targets, soft elevation tiers without aggressive borders, and pill-shaped interactive components instill confidence and fluid one-handed reachability.

## Colors

The palette is engineered around Google Maps' civic navigation language. It utilizes high-clarity tonal surfaces to segment content layers effortlessly.

### Roles & Semantic Structure
- **Primary (`#0b57d0`)**: Google Transit Deep Blue. Applied to active navigation trails, primary action buttons, selected sheet tabs, and key transit transfer points.
- **Secondary (`#137333`)**: Safe Operational Emerald. Used for "On Time", "Seats Available", "Low Occupancy", and live departure indicators. Paired with background fill `#e6f4ea`.
- **Tertiary (`#ea8600`)**: Warning Amber. Denotes minor service slowdowns, "Seats Filling Fast", and medium crowding. Paired with background fill `#fef7e0`.
- **Destructive / Delay (`#b3261e`)**: Alert Red. Used for route cancellations, severe detours, and out-of-service alerts. Paired with `#fce8e6`.
- **Neutral Palette**:
  - `surface-canvas`: `#ffffff` (Pure sheet canvas)
  - `surface-container-low`: `#f8f9fa` (Backdrop and search pill containers)
  - `surface-container`: `#f1f3f4` (Card tiles, inactive tabs)
  - `surface-container-high`: `#e8eaed` (Dividers, disabled states, route lines)
  - `text-primary`: `#1f1f1f` (Primary station titles, ETAs, route numbers)
  - `text-secondary`: `#444746` (Destination directions, platform tags)
  - `text-tertiary`: `#747775` (Timestamp metadata, walking distance calculations)

## Typography

The typography uses `Roboto Flex` for its high x-height, clear optical kerning, and precise legibility on outdoor mobile screens.

- **Numerics & Route Badges**: Station codes, platform badges, and arrival times (e.g., `2 min`, `14:02`) should consistently pair `label-md` or `headline-sm` with tabular lining numbers to prevent horizontal jitter during real-time GPS countdowns.
- **Hierarchy Rules**: Real-time arrival metrics are prioritized with medium-to-bold weights, while supplementary step-by-step directions sit comfortably in neutral `body-md`.
- **Text Truncation**: Route terminus titles truncate after two lines with an ellipsis; transit line badges (e.g., "M15-SBS") never truncate.

## Layout & Spacing

The layout is built around mobile-first full-viewport map surfaces overlaid with interactive bottom sheets, modal cards, and floating search bars.

### Layout Principles
- **Fluid Multi-Sheet Structure**: For compact viewports (<600px), interfaces utilize dynamic bottom sheets with three default snap points: collapsed (peek bar: 72px), half (nearby lines: 40%), and expanded (station schedule: 90%).
- **Vertical Spacing Rhythm**: An 8pt grid governs all structural spacing, while 4pt micro-increments handle compact badge paddings and inline status indicators.
- **Touch Target Assurance**: All transit taps (stops along a path, route selector pills, departure rows) enforce a minimum 48x48px interactive target, even if the visual element is smaller.

## Elevation & Depth

Visual hierarchy does not rely on heavy borders. It is achieved through subtle Material 3 ambient shadows and tonal surface shifts.

### Elevation Hierarchy
- **Level 0 (Map Surface)**: Underlay canvas containing map tiles and live geo-vectors.
- **Level 1 (Tonal Cards & Dividers)**: `#f8f9fa` or `#f1f3f4` containers within sheets without shadows, separating segments of an itinerary.
- **Level 2 (Floating Search & Chips)**: `0 1px 3px rgba(60,64,67, 0.3), 0 4px 8px 3px rgba(60,64,67, 0.15)`. Used for the floating destination search bar and filter chips over the map.
- **Level 3 (Interactive Bottom Sheet & Action Buttons)**: `0 1px 2px rgba(60,64,67, 0.3), 0 2px 6px 2px rgba(60,64,67, 0.15)`. Defines sheets that slide over map geometry with smooth gesture responsiveness.
- **Outlines**: 1px borders in `#e8eaed` appear strictly in unselected card states and input borders. Active states swap borders for a solid fill or a 2px primary focus ring.

## Shapes

The shape system strictly reflects the Google Maps visual language: ultra-soft corners and pill-shaped ergonomics.

### Shape Tiers
- **Pill (`rounded-full` / 9999px)**: Transit mode filters (Bus, Subway, Ferry), quick-action chips (Home, Work, Recent), search inputs, and primary floating action buttons (FABs).
- **Extra Large (`rounded-2xl` / 1.5rem - 2rem)**: Top edges of sliding bottom sheets, primary route option summary cards, and map preview popups.
- **Medium (`rounded-lg` / 0.75rem)**: Vehicle occupancy meters, step-by-step itinerary sequence containers, and stop schedule details.
- **Micro (`rounded-sm` / 0.25rem)**: Transit agency badge badges (e.g., train line numbers, line bullets).

## Components

### Buttons & FABs
- **Primary Action (FAB / Navigate)**: Fully pill-shaped (`rounded-full`), `#0b57d0` solid background with `#ffffff` bold text/iconography. Elevated at Level 3.
- **Secondary Buttons**: Tonal fill `#f1f3f4`, `#1f1f1f` label, no border, standard 44px height.
- **Icon Actions (Locate Me, Compass)**: 48x48px circle, `#ffffff` surface, subtle ambient drop shadow, `#444746` icon tint.

### Transit Chips & Filters
- **Filter Chips**: 32px height, pill-shaped. Inactive state: `#ffffff` surface with `#e8eaed` border and `#444746` text. Active state: `#e8f0fe` surface, `#0b57d0` bold text, no border, accompanied by a checkmark.

### Search Bar (Floating)
- Pill-shaped container (`rounded-full`) anchored at the top of the viewport. Surface `#ffffff`, elevation Level 2. Contains profile/menu icon, placeholder `#747775` ("Search stations, lines, stops..."), voice search button, and user avatar.

### Transit Line Badges
- Pill or rounded-rect capsules with high-contrast foreground icons/text matching official city transit authority colors (e.g., Red Line `#d93025`, Blue Line `#1a73e8`).

### Occupancy & Live Status Indicators
- **Green status pill**: `#e6f4ea` background with `#137333` text and pulsing dot. Label: "On time • Many seats".
- **Amber status pill**: `#fef7e0` background with `#ea8600` text. Label: "Delayed 4m • Standing room only".

### Departure Row Lists
- Zero-border layout using 12px vertical padding. Left column: large line badge and destination headsign. Right column: real-time arrival countdown (`2 min` in `#137333`, bold) with subsequent scheduled arrival in neutral `#747775` beneath.

### Interactive Bottom Sheet
- Continuous `#ffffff` background with 28px top-left and top-right radii. Includes a centered 4x32px drag handle in `#e8eaed` placed 8px from the top rim.