# Device tests

Manual test scripts for steps that need the Android emulator or a phone (PRD 0.1 rule 6), and the log of every run.

Rules:

- A test counts as passed only if someone ran it. Record failed runs too.
- Checks that the PRD assigns to a physical phone stay listed as "pending on a phone" until one is used.

## Results log

| Date | Script | Device or emulator | Android API | Build | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| | S0-M1 | | | | not run yet | |

## Pending on a physical phone

| PRD step | Check | Status |
| --- | --- | --- |
| S0 | App installs and opens on a physical Android 8.0+ phone | pending on a phone |

## S0

### S0-M1 dev client launch

Before you start, in a new PowerShell window:

- `echo $env:JAVA_HOME` prints the Android Studio JBR path.
- `echo $env:ANDROID_HOME` prints the Android SDK path.
- In Android Studio, SDK Manager shows **Android 16 (API 36)** under SDK Platforms and **NDK 27.1.12297006** under SDK Tools as installed.

Steps:

1. Confirm no other npm or Gradle process is running in the project folder.
2. Start the `Pixel_7` emulator from Android Studio's Device Manager.
3. In the project folder, run `npx expo run:android`. The first build downloads Gradle and Android libraries and can take a long time. Do not interrupt it.
4. Expect: the app "Tunton APP" opens on the emulator with no red error screen.
5. Tap each tab: Map, Plan, Profile. Expect each to show its title on the dark background.
6. Close the app and reopen it from the launcher. Expect it to open again.
7. In Android Settings, Apps, Tunton APP, note the app is installed. Note the emulator's Android version and API level.
8. Add a row to the results log with the date, emulator model, API level and result.

If the build fails, copy the first error block from the terminal into the Notes column and stop.
