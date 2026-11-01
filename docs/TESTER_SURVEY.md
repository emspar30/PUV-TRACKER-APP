# Tunton tester survey (draft for the Google Form)

Copy each section into Google Forms as a section. Question types are given in brackets. Keep the form in English; testers may answer open questions in English, Cebuano or Filipino.

After the form is made, send its link (the `https://forms.gle/...` share link). It goes in `FEEDBACK_FORM_URL` (`src/shared/config/index.ts`), so the app's Menu → Give feedback opens it.

---

## Section 1. Consent

**Intro text:** Thank you for testing Tunton, a multicab tracking app for Butuan City. This survey takes about 10 minutes. Your answers are used only for our capstone study. We do not ask for your name. You may skip any question and stop at any time.

1. I have read the above and agree to take part. [Multiple choice, required: Yes / No. If No, submit the form.]

## Section 2. About you

2. Which best describes you? [Multiple choice: Student / Working commuter / Senior citizen / Person with disability / Multicab driver / IT professional or expert / Other]
3. How often do you ride a multicab? [Multiple choice: Every day / A few times a week / A few times a month / Rarely / Never]
4. Which routes do you usually ride? [Checkboxes: R1, R2, R3, R4, R5, R14, I do not know the route number, None]
5. Phone brand and model. [Short answer, for example "Samsung A15"]
6. Android version, if you know it. [Short answer]
7. Did you test with live data or Demo data? [Multiple choice: Live / Demo / Both / Not sure]

## Section 3. What you tried

For each feature: [Multiple choice grid. Rows: the features. Columns: Worked well / Worked with problems / Did not work / Did not try]

8. Features:
   - Sign up and the introduction (avatar, fare type, places)
   - Map: route lines, stops and the route list
   - Seeing multicabs on the map
   - Tracking a multicab (arrival time, alerts)
   - Check-in at a stop
   - Check-in near the route
   - Relay a multicab update
   - My Rides: trip planner and fare estimate
   - Crowdsource feed (reading and flagging reports)
   - Ask Tunie (the assistant)
   - Energy wallet
   - Night Mode (after 9 PM)
   - Offline use (map, routes and fares without internet)
   - Settings (dark mode, labels, alerts)

9. What was the most useful feature for you? [Short answer]
10. What did not work, or confused you? Please say which screen. [Paragraph]

## Section 4. Ease of use (System Usability Scale)

Rate each statement. [Linear scale 1 to 5, 1 = Strongly disagree, 5 = Strongly agree. Required. Keep the order and the wording; the score depends on it.]

11. I think that I would like to use this app frequently.
12. I found the app unnecessarily complex.
13. I thought the app was easy to use.
14. I think that I would need the support of a technical person to be able to use this app.
15. I found the various functions in this app were well integrated.
16. I thought there was too much inconsistency in this app.
17. I would imagine that most people would learn to use this app very quickly.
18. I found the app very cumbersome to use.
19. I felt very confident using the app.
20. I needed to learn a lot of things before I could get going with this app.

Scoring (for the study, not in the form): for odd items, score minus 1; for even items, 5 minus score; add the ten results and multiply by 2.5. The result is 0 to 100; 68 is average.

## Section 5. Software quality (ISO/IEC 25010)

Rate each statement. [Linear scale 1 to 5, 1 = Strongly disagree, 5 = Strongly agree. Optional for commuters; asked of IT experts.]

**Functional suitability**
21. The app does what it says: shows routes, multicabs, fares and reports.
22. The results are correct (routes, stops, fares, arrival times).

**Performance efficiency**
23. The app opens and responds quickly.
24. The app does not drain my battery or data noticeably.

**Usability**
25. The screens, buttons and words are clear.
26. Error messages tell me what to do next.

**Reliability**
27. The app did not crash or freeze.
28. The app still worked when my internet was slow or gone.

**Security and privacy**
29. I understood what location data the app uses and why.
30. I trust the app with my location while I relay a ride.

**Compatibility**
31. The app worked well on my phone and with other apps open.

## Section 6. Overall

32. How likely are you to recommend Tunton to a friend who rides multicabs? [Linear scale 0 to 10]
33. Would you use Tunton every day if it covered your route? [Multiple choice: Yes / Maybe / No]
34. Anything else you want to tell us? [Paragraph]

**Closing text:** Thank you. Your feedback helps us make Tunton better for Butuan commuters.
