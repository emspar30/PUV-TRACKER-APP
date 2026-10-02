# Build the Android app and send back the APK

This guide is for the project partner. The goal is one file, `app-debug.apk`, built on your computer and sent to Emjay.

**Why you are doing this.** The first Android build has to download about 1.5 GB of libraries, including one 266 MB file. Emjay's connection could not finish it. Git cannot carry those downloads between computers, so the build has to happen on a faster connection and the finished app file is sent back.

**What you need to know first**

- You only build. Do not change any project file, and do not commit or push anything.
- The first build takes 20 to 60 minutes on a good connection and needs about 10 GB of free disk space.
- This build has never been completed on any computer, so it may fail. If it does, step 7 says what to send back.
- Commands are for Windows PowerShell. On macOS or Linux, use `./gradlew` instead of `.\gradlew.bat`.

## 1. Install the tools (skip any you already have)

| Tool | Version | Where |
| --- | --- | --- |
| Git | any recent | https://git-scm.com |
| Node.js | 22 or 24 (LTS) | https://nodejs.org |
| Android Studio | current | https://developer.android.com/studio |

After installing Android Studio, open it once and let the setup wizard install the Android SDK.

Then set two environment variables (Windows: Start, "Edit environment variables for your account", New):

| Name | Value |
| --- | --- |
| `ANDROID_HOME` | `C:\Users\<your user name>\AppData\Local\Android\Sdk` |
| `JAVA_HOME` | `C:\Program Files\Android\Android Studio\jbr` |

Close and reopen PowerShell so it sees them. Check:

```powershell
node --version
echo $env:ANDROID_HOME
echo $env:JAVA_HOME
```

Each line must print a value.

## 2. Get the code

```powershell
git clone https://github.com/emspar30/PUV-TRACKER-APP.git
cd PUV-TRACKER-APP
git log --oneline -n 1
```

Write down the short code at the start of the last line (for example `a1b2c3d`). Emjay needs it to confirm the app was built from the right version.

If you already have the folder, run `git pull` inside it instead of cloning.

## 3. Install the JavaScript packages

```powershell
npm ci
```

Use `npm ci`, not `npm install`. It installs exactly the versions recorded in the project and does not change any file. It should end with "added ... packages" and no line starting with `npm error`.

## 4. Generate the Android project

```powershell
npx expo prebuild --platform android
```

This creates an `android` folder. Expect the line "Finished prebuild". One yellow note about `userInterfaceStyle` and `expo-system-ui` is expected and can be ignored.

If it asks whether to continue because of uncommitted changes, answer yes.

## 5. Build the APK

```powershell
cd android
.\gradlew.bat app:assembleDebug
```

What to expect:

- Gradle downloads itself first, then Android components (platform 36, NDK 27.1, build tools). If it stops with a licence message, open Android Studio, go to Settings, Languages and Frameworks, Android SDK, install **Android 16 (API 36)** under SDK Platforms and **NDK (Side by side) 27.1.12297006** under SDK Tools, accept the licences, and run the command again.
- It can sit for several minutes with no new lines while it downloads large files. That is normal. Do not close the window.
- It ends with **`BUILD SUCCESSFUL`**.

No phone or emulator is needed for this step.

## 6. Send the APK

The file is here, inside the project folder:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

Check it exists and note its size:

```powershell
Get-Item app\build\outputs\apk\debug\app-debug.apk | Select-Object Length, LastWriteTime
```

Send Emjay:

1. The file `app-debug.apk`, by Google Drive, a chat app that allows large files, or a USB stick. It may be 100 MB or more. **Do not add it to git.**
2. The short code you wrote down in step 2.
3. How long the build took.

## 7. If the build fails

Do not try to fix project files. Send Emjay:

1. The first block that starts with `FAILURE:` and the section under `* What went wrong:`.
2. The last 30 lines of the output.
3. The output of `node --version` and of `& "$env:JAVA_HOME\bin\java.exe" -version`.

To save the whole output to a file next time, run the build like this and send `build-log.txt`:

```powershell
.\gradlew.bat app:assembleDebug *> build-log.txt
```

## 8. Rules

- Do not run `git add`, `git commit` or `git push`.
- Do not run `npm install <package>`, `npm update`, `npm audit fix` or `npx expo install`.
- Do not edit `package.json`, `package-lock.json`, `app.json` or anything in `src/`.
- The `android` and `node_modules` folders are ignored by git on purpose. Leave them out.

---

## For Emjay: installing the APK when it arrives

1. Save `app-debug.apk` somewhere outside the project, for example `C:\Users\Emjay\Downloads\`.
2. Confirm the short code from your partner matches the newest commit: `git log --oneline -n 1`.
3. Start the `Pixel_7` emulator from Android Studio's Device Manager.
4. Install the app:

   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r "C:\Users\Emjay\Downloads\app-debug.apk"
   ```

   Expect `Success`.
5. Start the development server in the project folder:

   ```powershell
   npx expo start --dev-client
   ```

   Press `a` to open the app on the emulator.
6. Continue with test `S0-M1` in `docs/device-tests.md` from step 4 (the app opens, the three tabs work) and record the result.

No Gradle build runs on this computer in these steps. A new APK from your partner is needed only when a package with native code is added or `app.json` changes, for example when `expo-system-ui` is installed.
