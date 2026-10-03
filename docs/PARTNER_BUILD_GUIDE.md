# Set up and run the app on your own computer

This guide is for the project partner. The goal is to build the app on your computer and open it on your emulator or phone, then tell Emjay how it went.

**Why you are doing this.** The first build on Emjay's PC took a whole evening and hit three separate problems. We want to know which of them were caused by that PC and its network, and which will happen to anyone. Your notes answer that.

**What to know first**

- Do not change any project file, and do not commit or push anything.
- Use the newest commit. An older copy of the project fails at step 5 with a "Filename longer than 260 characters" error.
- The first build downloads about 2 GB and needs about 10 GB of free disk space. On Emjay's PC the final build took 9 minutes once the downloads were in place.
- Commands are for Windows PowerShell. Enter them one line at a time. On macOS or Linux, use `./gradlew` instead of `.\gradlew.bat`.
- Please write down how long each step takes and any error you see.

## 1. Install the tools (skip any you already have)

| Tool | Version | Where |
| --- | --- | --- |
| Git | any recent | https://git-scm.com |
| Node.js | 22 or 24 (LTS) | https://nodejs.org |
| JDK | **17** | https://adoptium.net (Temurin 17) |
| Android Studio | current | https://developer.android.com/studio |

Open Android Studio once and let the setup wizard install the Android SDK. Then, in Settings, Languages and Frameworks, Android SDK:

- SDK Platforms: install **Android 16 (API 36)**.
- SDK Tools: install **NDK (Side by side) 27.1.12297006** and **CMake 3.22.1**, and accept the licences.

**Use JDK 17, not the Java inside Android Studio.** Recent Android Studio versions bundle Java 25, and the build fails on it.

## 2. Get the code

```powershell
git clone https://github.com/emspar30/PUV-TRACKER-APP.git
```

```powershell
cd PUV-TRACKER-APP
```

```powershell
git log --oneline -n 1
```

Write down the short code at the start of that last line. If you already have the folder, run `git pull` inside it instead of cloning.

## 3. Install the JavaScript packages

```powershell
npm ci
```

Use `npm ci`, not `npm install`. It installs exactly the versions recorded in the project and changes no file. Then check one version:

```powershell
npm ls react-native-gesture-handler
```

It must show `2.32.x`. If it shows `3.x`, your copy of the project is too old; run `git pull` and `npm ci` again.

## 4. Generate the Android project

```powershell
npx expo prebuild --platform android
```

Expect "Finished prebuild". (Since R1a, `expo-system-ui` is installed, so the old yellow note about `userInterfaceStyle` should no longer appear.)

## 5. Build

**EAS cloud builds (note, 2026-10-04).** `eas.json` and the EAS project ID in `app.json` (`extra.eas.projectId`) belong to the partner's Expo account, for his phone builds (`npx eas-cli@latest build --profile development --platform android`). The local build below does not need them, an Expo account or a login. Neither file holds a token or a password; never add one.

Set the Java version for this terminal window. Adjust the path to where your JDK 17 is installed:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19-hotspot"
```

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
```

```powershell
cd android
```

```powershell
.\gradlew.bat app:assembleDebug
```

It can go several minutes with no new lines while it downloads large files. It ends with **`BUILD SUCCESSFUL`**, and the app file is `android\app\build\outputs\apk\debug\app-debug.apk` (about 300 MB).

## 6. Run the app

Start an Android emulator from Android Studio's Device Manager, or connect a phone with USB debugging turned on. Then, still in the `android` folder:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r app\build\outputs\apk\debug\app-debug.apk
```

```powershell
cd ..
```

```powershell
npx expo start --dev-client
```

Press `a` to open the app. The first load takes up to a minute.

**What you should see:** a dark screen titled "Map" with three grey cards, and a tab bar with Map, Plan and Profile. Tapping each tab changes the title. That is all the app does at this stage.

## 7. Problems Emjay hit, and their fixes

| What you see | Cause | Fix |
| --- | --- | --- |
| The build sits for more than 15 minutes at lines like `compileDebugKotlin`, with no new output | A large download from `repo.reactnative.dev` stalls on some networks over IPv4 | Press Ctrl+C. Run `.\gradlew.bat --stop`, then `$env:JAVA_TOOL_OPTIONS = "-Djava.net.preferIPv6Addresses=true"`, then build again |
| `configureCMakeDebug ... A restricted method in java.lang.System has been called` | The build is running on Java 25 | Check `$env:JAVA_HOME` points at JDK 17. Run `.\gradlew.bat --stop` and build again |
| `ninja: error: ... Filename longer than 260 characters` | Old copy of the project with the wrong `react-native-gesture-handler` | `git pull`, `npm ci`, then build again |
| A red screen at launch mentioning `FabricUIManager` and `RNSModule` | A known start-up bug in a navigation library. The project patches it, so you should not see this. | Check that `npm ci` printed `react-native-screens@4.26.2 ✔` under "Applying patches". Then close the app completely, or run `adb shell am force-stop com.tunton.app`, and open it again. Tell Emjay if it happened. |
| A blank dark screen that never loads | Left over from the red screen above | Same as above |

## 8. What to send Emjay

1. The short code from step 2.
2. Your Windows version, RAM, and whether you used an emulator or a phone.
3. How long steps 3, 5 and 6 took.
4. Which problems from step 7 you hit, if any. **If you did not need the IPv6 setting, say so**: that tells us the download stall was specific to Emjay's network.
5. Whether the red screen appeared, and on which launch.
6. For any other error: the section under `* What went wrong:` and the last 30 lines of output.

To save the whole build output to a file:

```powershell
.\gradlew.bat app:assembleDebug *> build-log.txt
```

## 9. Rules

- Do not run `git add`, `git commit` or `git push`.
- Do not run `npm install <package>`, `npm update`, `npm audit fix` or `npx expo install`.
- Do not edit `package.json`, `package-lock.json`, `app.json` or anything in `src/`.
- The `android` and `node_modules` folders are ignored by git on purpose. Leave them out.
