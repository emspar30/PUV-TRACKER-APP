# UI/UX Feedback & Bug Fixes (v0 Prototype)

## 1. Live Map
* **Fix ETA Logic:** Do not drop the ETA when a PUV passes the commuter's location. If it's the only active PUV on a loop, keep calculating the ETA as it circles back.
* **Fix Demo Vehicle Looping:** Demo PUVs currently pause and teleport/U-turn. Update simulator logic to make them drive continuous loops to mimic real behavior.
* **Remove Redundancy:** Remove duplicate time indicators (e.g., display either "Last update" OR "Synced", not both).
* **Color Updates:** Change "Alert on" button to Blue, and "Cancel/stop tracking" button to Red.
* **Global Tracking State:** 
  * Fix the bug where switching between routes (e.g., R4 to R5 and back) stops the active tracking session.
  * Add a persistent active tracking indicator (or quick-access button) on the map so users can always jump back to their tracked PUV.
  * Add distance push/toast alerts when the tracked PUV is at 1km, 500m, 250m, and 100m.

## 2. Passenger Relay (Reporting)
* **BLE Auto-fill:** If a commuter's presence is verified via BLE, hide the manual Route and PUV ID selection. Auto-fill these fields immediately.
* **Form Simplification:** The required flow should just be: Seat Availability -> "What's happening" (optional) -> Destination (to trigger broadcast termination) -> GPS broadcast toggle.

## 3. Check-in
* **Map UI:** Show all route stops on the map by default. Add a filter/category toggle so commuters can isolate specific route numbers.
* **Component Additions:** Add a "Center Location" FAB and a "Minimize Card" button to the check-in bottom sheet.
* **UX Polish:** Redesign the route selection UI to be smoother and more intuitive (take inspiration from Google Maps place sheets).
* **Remove Redundancy:** Remove either the timer or the progress bar (they duplicate the same function).
* **Cleanup:** Remove "Demo", "Not location-verified", and "Sample data" labels.
* **Global State Indicator:** Add a red dot indicator on the bottom navbar icons to show when a check-in is active in the background.
* **Notifications:** Trigger a local alert/toast after 5 minutes of active check-in to remind the user if they are off-screen.
* **Post-Check-in State:** Clicking "I boarded" should replace the card with a "Safe Travel" goodbye state rather than abruptly closing.

## 4. My Rides
* **Fix Scrolling/Layout:** The horizontal navigation breaks the UI; content scrolls awkwardly behind the map. Constrain the view layout properly.
* **Fix Expanded Mode:** When entering full/expanded mode, the content and fillable fields disappear. Ensure z-indexing and component visibility are maintained in full screen.

## 5. Crowdsource (Feed)
* **Condense UI:** The report cards are too large. Make them compact. 
* **Required Data Points:** Only show: Route #, PUV ID/Plate, Time, Seats Available, and Status ("What's happening").
* **Location Tagging:** Capture and display the closest street/stop where the report was posted, even if the user has ongoing GPS broadcasting turned off. 
* **Cleanup:** Remove the "Demo" pill background entirely.

## 6. Profile
* **Avatar Selection:** Hide the 12-avatar grid. It should only appear if the current avatar is clicked. Remove the "Shuffle" button (keep that onboarding-only).
* **Handle UI:** Remove the standalone "Handle" input field. Add a small 'Edit' pencil icon next to the display name to save space.
* **Fare Type:** Convert the Fare Type selector into a compact dropdown.
* **Energy Wallet Redesign:** Detach tracking energy from the commuter info card. Redesign it as a sleek progress bar (with a lightning icon) placed below the info card.
* **Trust Badges:** Remove arbitrary gamification badges. Replace with a single "Verified/Trusted" badge (placed at the bottom right of the avatar) based on trust points. Ensure this badge propagates to their posts in the Crowdsource feed.
* **Cleanup:** Remove "Storage info" and "Location history".
* **History Section:** Rename to "General History" (encompassing all actions, not just energy). Add a collapse/expand toggle and a "Clear History" button.

## 7. Global Animations & UI Polish
* **Remove Bouncy Physics:** The wobble/bounce effect on successful reports and check-ins feels too comical. Replace all exaggerated physics with smooth, subtle ease-in/ease-out transitions.
* **Fix Screen Transitions (Settings/Menu):** Remove the awkward bottom-sheet darkening overlay that shows visible edges. Instead, make the settings/menu screen slide in from right-to-left covering the full screen (similar to Instagram's profile menus), without background dimming.
* **Skeleton Loaders:** Add skeleton loading states to all tabs. Make the delay slightly longer for Crowdsource, Profile, and Notifications to ensure smooth data fetching transitions.