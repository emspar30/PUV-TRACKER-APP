# Device tests

Manual test scripts for steps that need the Android emulator or a phone (PRD 0.1 rule 6), and the log of every run.

Rules:

- A test counts as passed only if someone ran it. Record failed runs too.
- Checks that the PRD assigns to a physical phone stay listed as "pending on a phone" until one is used.

## Results log

| Date | Script | Device or emulator | Android API | Build | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-02 | S0-M1 | `Pixel_7` emulator | 34 | Local debug build, `npx expo run:android`, started 7:39 PM | **Not completed** (stopped at 9:22 PM, no pass or fail) | Prebuild succeeded and created `android/`. Gradle 9.3.1 configured the project and began compiling the native modules. The build then waited on one download from Maven Central, believed to be `react-android-0.86.3-debug.aar` (266 MB), arriving at about 11 KB/s after two dropped attempts. No APK was produced and the app was never installed or opened. No build error occurred. Next attempt: partner builds the APK on a faster connection (`docs/PARTNER_BUILD_GUIDE.md`). |
| 2026-10-02 | S0-M1 | `Pixel_7` emulator (x86_64) | 34 | Debug APK (305.8 MB) built 11:13 PM with `.\gradlew.bat app:assembleDebug` on JDK 17; installed with `adb install`; dev server `npx expo start --dev-client` | **Pass** (on the second launch) | First launch at 11:22 PM showed a red error screen: `null cannot be cast to non-null type com.facebook.react.fabric.FabricUIManager` at `ScreensModule.setupFabric`. This is a known start-up race in `react-native-screens` (issue 4699). After `adb shell am force-stop com.tunton.app` and reopening at 11:28 PM the app opened. Map, Plan and Profile each show their title; closing and reopening from the launcher worked. Tab checks and reopen confirmed by Emjay. |

## Known issues when running S0-M1

| Symptom | Cause | What to do |
| --- | --- | --- |
| Build sits for a long time at the Kotlin compile tasks with no output | A large library download from `repo.reactnative.dev` stalls over IPv4 on this network | In the build terminal, before building: `$env:JAVA_TOOL_OPTIONS = "-Djava.net.preferIPv6Addresses=true"` |
| `configureCMakeDebug` fails with `A restricted method in java.lang.System has been called` | Gradle is running on Java 25 | In the build terminal: `$env:JAVA_HOME = "C:\Program Files\Java\jdk-17.0.19"`, then `.\gradlew.bat --stop` and build again |
| `ninja: error: ... Filename longer than 260 characters` | `react-native-gesture-handler` 3.x was installed instead of the SDK version | Fixed in the project by pinning `~2.32.0`; run `npm ci` to get it |
| Red screen at launch mentioning `FabricUIManager` and `RNSModule` | Start-up race in `react-native-screens` | Force-stop the app and open it again |
| Blank dark screen after dismissing the red screen | The app is left in a broken state by the error above | Force-stop the app and open it again |

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
