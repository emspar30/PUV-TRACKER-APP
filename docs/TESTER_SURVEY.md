# Tunton user survey (draft for the Google Form)

Copy each section into Google Forms as a section. Question types are given in brackets. Keep the form in English; respondents may answer open questions in English, Cebuano or Filipino.

After the form is made, send its link (the `https://forms.gle/...` share link). It goes in `FEEDBACK_FORM_URL` (`src/shared/config/index.ts`), so the app's Menu → Give feedback opens it.

Revised 2026-11-04 to answer the proposal panel (`docs/PANEL_AUDIT.md`, S11, D1, A6). Every cited source is from 2021 to 2026. Commuters and drivers give their perception of the app, not a test report, so their path is short. Only the IT experts evaluate the product's quality.

| Part | Measures | Who answers | Recent sources that use or review it | Status |
| --- | --- | --- | --- | --- |
| A. System Usability Scale (SUS) | Usability | Everyone | Vlachogianni and Tselios (2022); Hyzy et al. (2022) | Adopted standard instrument, 10 items, wording unchanged |
| B. Technology Acceptance Model (TAM) | Perceived usefulness, perceived ease of use, intention to use | Commuters and drivers | Marikyan et al. (2023); Altay and Okumuş (2022); Yuduang et al. (2022) | Adopted constructs, wording adapted to commuting and to driving |
| C. ISO/IEC 25010:2023 product quality | Six characteristics, one item per sub-characteristic | IT experts | ISO/IEC 25010:2023 | Researcher-made from the standard; needs content validation (section 8.4) |

| Respondent | Sections | Items | Time |
| --- | --- | --- | --- |
| Commuter | 1, 2, 3, 6 | 31 | about 8 minutes |
| Driver | 1, 2, 4, 6 | 31 | about 8 minutes |
| IT expert | 1, 2, 5, 6 | 47 | about 15 minutes |

Section 8 explains why these were chosen, how each is scored and interpreted, and how the team establishes validity and reliability before data collection. Read it before you build the form.

---

## Section 1. Consent

**Intro text:** Thank you for trying Tunton, a multicab app for Butuan City. This survey takes about 8 minutes (about 15 for IT experts). Your answers are used only for our capstone study. We do not ask for your name. You may skip any question that is not marked required, and stop at any time.

1. I have read the above and agree to take part. [Multiple choice, required: Yes / No. If No, submit the form.]

## Section 2. About you

2. Which best describes you? [Multiple choice, required: Student / Working commuter / Senior citizen / Person with disability / Multicab driver / IT professional or expert / Other]
   - Google Forms: "Go to section based on answer". Multicab driver goes to Section 4; IT professional or expert goes to Section 5; everyone else goes to Section 3.
3. How often do you ride or drive a multicab? [Multiple choice: Every day / A few times a week / A few times a month / Rarely / Never]
4. Which routes do you usually ride or drive? [Checkboxes: R1, R2, R3, R4, R5, R14, I do not know the route number, None]

## Section 3. Commuters: your view of the app

### Part A: Ease of use (System Usability Scale)

**Instruction:** Rate each statement about the Tunton app. [Linear scale 1 to 5, 1 = Strongly disagree, 5 = Strongly agree. All required.]

Keep the order and the wording; the score depends on both. The only change from the standard wording is "system" to "app". Item 12 adds "(awkward)", because many respondents are not native English speakers and may not know "cumbersome" (see section 8.5).

5. I think that I would like to use this app frequently.
6. I found the app unnecessarily complex.
7. I thought the app was easy to use.
8. I think that I would need the support of a technical person to be able to use this app.
9. I found the various functions in this app were well integrated.
10. I thought there was too much inconsistency in this app.
11. I would imagine that most people would learn to use this app very quickly.
12. I found the app very cumbersome (awkward) to use.
13. I felt very confident using the app.
14. I needed to learn a lot of things before I could get going with this app.

### Part B: Usefulness and intention to use (Technology Acceptance Model)

**Instruction:** Rate each statement. [Linear scale 1 to 5, 1 = Strongly disagree, 5 = Strongly agree. All required.]

The items keep the standard TAM wording, with "for my daily commute" in place of "in my job". The tense is the present, because the respondents have used the app.

**Perceived usefulness (PU)**
15. Using Tunton lets me make my trips more quickly.
16. Using Tunton improves my daily commute.
17. Using Tunton helps me get more done in less time when I commute.
18. Using Tunton makes me more effective at getting where I need to go.
19. Using Tunton makes my daily commute easier.
20. I find Tunton useful for my daily commute.

**Perceived ease of use (PEOU)**
21. Learning to use Tunton is easy for me.
22. I find it easy to get Tunton to do what I want it to do.
23. My interaction with Tunton is clear and understandable.
24. I find Tunton flexible to interact with.
25. It is easy for me to become skillful at using Tunton.
26. I find Tunton easy to use.

**Behavioral intention (BI)**
27. Assuming I have access to Tunton, I intend to use it.
28. Given that I have access to Tunton, I predict that I would use it.

Then go to Section 6.

## Section 4. Drivers: your view of the app

In Google Forms, duplicate Section 3 and change only the words below. Keep the item numbers, so the scoring is the same for both groups.

- Part A (items 5 to 14): unchanged. "The app" means the Tunton Driver app.
- Part B, perceived usefulness:
  15. Using Tunton lets me do my rounds more quickly.
  16. Using Tunton improves my work as a driver.
  17. Using Tunton helps me get more done in less time when I drive.
  18. Using Tunton makes me more effective at finding passengers.
  19. Using Tunton makes my work as a driver easier.
  20. I find Tunton useful for my work as a driver.
- Part B, perceived ease of use and intention (items 21 to 28): unchanged.

Then go to Section 6.

## Section 5. IT experts: testing and product quality

**Intro text:** Please use both the commuter app and the driver app before you answer. These questions ask about the product's quality, not only your own use.

29. Phone brand and model. [Short answer, for example "Samsung A15"]
30. Android version, if you know it. [Short answer]
31. Did you test with live data or Demo data? [Multiple choice: Live / Demo / Both / Not sure]
32. For each feature: [Multiple choice grid. Rows: the features. Columns: Worked well / Worked with problems / Did not work / Did not try]
    - Commuter app: sign up and the introduction (avatar, fare type, places)
    - Commuter app: map, route lines, stops and the route list
    - Commuter app: seeing and tracking multicabs (arrival time, alerts)
    - Commuter app: check-in at a stop or near the route
    - Commuter app: relay a multicab update
    - Commuter app: My Rides, trip planner and fare estimate
    - Commuter app: Crowdsource feed (reading and flagging reports)
    - Commuter app: Ask Tunie (the assistant)
    - Commuter app: Energy wallet
    - Commuter app: Night Mode (after 9 PM)
    - Commuter app: offline use (map, routes and fares without internet)
    - Driver app: registration with a selfie holding an LTFRB document, and a multicab photo
    - Driver app: the beacon, on and off
    - Driver app: waiting counts per stop (received by SMS)

### Part A: Ease of use (System Usability Scale)

Items 5 to 14, exactly as in Section 3, about the commuter app.

### Part C: Software quality (ISO/IEC 25010:2023)

**Instruction:** Rate each statement about the Tunton system. [Linear scale 1 to 5, 1 = Strongly disagree, 5 = Strongly agree. All required.]

Each item names the 2023 sub-characteristic it measures.

**Functional suitability**
33. *(functional completeness)* The system provides the functions its users need: finding routes, following multicabs, checking in, relaying and estimating fares for commuters, and registration, the beacon and waiting counts for drivers.
34. *(functional correctness)* The system gives correct results: routes, stops, fares, arrival times and waiting counts.
35. *(functional appropriateness)* The system's functions help users finish their tasks without unnecessary steps.

**Performance efficiency**
36. *(time behaviour)* The app responds quickly to taps, searches and map movements.
37. *(resource utilization)* The app uses a reasonable amount of battery, mobile data and storage.
38. *(capacity)* The app stays responsive with all routes, stops and multicabs shown on the map.

**Interaction capability** (called usability in the 2011 edition)
39. *(appropriateness recognizability)* From the screens, users can easily tell whether the app suits their needs.
40. *(learnability)* Users can learn to use the app's functions quickly.
41. *(operability)* The app is easy to operate and control.
42. *(user error protection)* The app helps users avoid mistakes, for example by confirming before it sends.
43. *(user engagement)* The screens are pleasant and invite continued use.
44. *(inclusivity)* People of different ages, backgrounds and languages can use the app.
45. *(user assistance)* People with different abilities, such as poor eyesight, can use the app: the text is readable, the colours are clear and the buttons are large enough.
46. *(self-descriptiveness)* The screens explain themselves; users do not need instructions from someone else to know what to do.

**Reliability**
47. *(faultlessness)* The app performs its functions without errors in normal use.
48. *(availability)* The app's features are available when they are needed.
49. *(fault tolerance)* The app keeps working when the internet is slow or gone.
50. *(recoverability)* After an interruption, such as a lost signal or the app being closed, the app returns to what the user was doing.

**Security**
51. *(confidentiality)* The system shows users' information only to those who should see it.
52. *(integrity)* The system prevents false or altered reports from changing what other users see.
53. *(non-repudiation)* An account cannot deny a report, flag or approval that it made.
54. *(accountability)* Actions such as reports, flags and approvals can be traced to the account that made them.
55. *(authenticity)* The system confirms who users are and which multicab a relay comes from.
56. *(resistance)* The system withstands misuse, such as fake GPS locations, replayed beacon codes and spam reports.

**Compatibility**
57. *(co-existence)* The app works well with other apps open on the phone.
58. *(interoperability)* The commuter app, driver app, server and SMS gateway exchange information correctly.

Then go to Section 6.

## Section 6. Your feedback

59. What did you like most about Tunton? [Short answer]
60. What confused you or did not work? Please say which screen. [Paragraph]
61. Anything else you want to tell us? [Paragraph]

**Closing text:** Thank you. Your feedback helps us make Tunton better for Butuan commuters.

---

## 8. For the study: sources, scoring and validity (not in the form)

### 8.1 Why these instruments

- **SUS** is the most used standardised usability questionnaire.
  - Vlachogianni and Tselios (2022) reviewed 104 studies that used it to evaluate educational technology. Mobile applications averaged 73.62.
  - Hyzy et al. (2022) pooled 117 SUS scores of 114 digital health apps. They confirmed that the benchmark of 68 suits mobile apps.
  - The SUS answers the panel's request for usability and Objective 6's interaction capability (usability).
- **TAM** explains acceptance through perceived usefulness and perceived ease of use, which predict the intention to use (Marikyan et al., 2023).
  - The panel named it (Dalaorao: "SUS, TAM or UTAUT"; Araneta: "TAM + ISO 25010").
  - It has been applied to trip-planning apps (Altay & Okumuş, 2022) and to a mobile app in the Philippines (Yuduang et al., 2022).
  - TAM was chosen over UTAUT because UTAUT has more constructs and moderators, and needs a larger sample than the study's 45 commuters and drivers.
  - Perceived usefulness and intention answer the panel's question on effectiveness and continued use.
- **ISO/IEC 25010:2023** is the current edition of the quality model named in Objective 6 and section 3.7.3.
  - The standard defines characteristics, not a questionnaire, so Part C is researcher-made and must be validated (8.4).
  - It has one item per sub-characteristic for six of the nine characteristics. Maintainability, flexibility and safety are left out, because they cannot be judged by using the app.
  - The manuscript must cite the 2023 edition throughout. The 2023 edition renames usability to interaction capability, and reliability's maturity to faultlessness.
- **Who answers what.** Commuters and drivers rate what they experience: ease of use (SUS) and usefulness and intention (TAM). Most ISO/IEC 25010 sub-characteristics, such as integrity, non-repudiation and interoperability, need technical knowledge, so Part C goes to the IT experts, who also use the feature grid as a test. This keeps the commuter and driver form to 31 items. The manuscript must say so in Objective 6, section 3.7.3 and the Chapter 4 plan.
- The earlier draft's recommend-to-a-friend item and its "use every day" item were removed. Their sources were older than five years, and the TAM intention items (27-28) measure the same thing.

### 8.2 Scoring

- **SUS (items 5-14):**
  - For items 5, 7, 9, 11 and 13 (the standard odd items), score minus 1.
  - For items 6, 8, 10, 12 and 14 (the standard even items), 5 minus score.
  - Add the ten results and multiply by 2.5. The result is 0 to 100.
- **TAM (items 15-28):**
  - The mean of each construct per respondent: PU (15-20), PEOU (21-26), BI (27-28).
  - Then the weighted mean per group (commuters, drivers).
- **ISO/IEC 25010:2023 (items 33-58), IT experts only:**
  - The weighted mean per item, then per characteristic (the mean of its items), then the overall mean.

### 8.3 Interpretation

- **SUS:** 68 is the benchmark (Hyzy et al., 2022). Report the mean SUS score and its standard deviation per group (commuters, drivers, IT experts), and compare them with 68 and with the 73.62 mean of mobile applications (Vlachogianni & Tselios, 2022).
- **TAM and ISO/IEC 25010:2023:** the manuscript's Table 3.2 scale.

| Weighted mean | Interpretation |
| --- | --- |
| 4.50 to 5.00 | Excellent |
| 3.50 to 4.49 | Very Good |
| 2.50 to 3.49 | Good |
| 1.50 to 2.49 | Fair |
| 1.00 to 1.49 | Poor |

### 8.4 Validity and reliability procedure (before data collection)

1. **Content validity of Part C and of the adapted TAM wording (Lawshe's content validity ratio).**
   - Give the items to **five** validators: IT faculty or IT professionals who are not among the respondents. Each validator marks each item "essential", "useful but not essential" or "not necessary".
   - The content validity ratio of an item is CVR = (n<sub>e</sub> − N/2) / (N/2), where n<sub>e</sub> is the number of validators who marked it essential and N is the number of validators.
   - With five validators, the critical CVR is 0.99 to 1.00 (Romero Jeldres et al., 2023, Table 1), so all five must mark an item essential. Lawshe's method does not apply to panels of fewer than five.
   - Revise or drop any item that fails. The content validity index is the mean CVR of the items kept; it should reach 0.70 (Romero Jeldres et al., 2023).
2. **SUS** keeps its standard wording, apart from "app" and "(awkward)". Its validity is the one reported in the reviews above, so it is not re-validated.
3. **Pilot test.** Run the form with 10 to 15 people who are like the respondents but are not among them, on the tester build. Ask them which items were unclear.
4. **Reliability.** On the pilot answers, and again on the final answers, compute Cronbach's alpha and McDonald's omega for the SUS (after reversing items 6, 8, 10, 12 and 14) and for each TAM construct.

   An alpha of 0.70 or higher is the usual standard, although it is a convention, not a rule from Cronbach. Omega is also reported because it does not assume equal item loadings (Kumar, 2024). Part C is answered by five IT experts, too few for alpha or omega, so it is reported with weighted means only, and its validity rests on step 1.
5. **Translation.** If a Cebuano or Filipino version is used, translate it forward and back by two different bilingual people, and compare the back translation with the English items.
6. Record steps 1 to 5 in the manuscript, section 3.7.3: the validators' qualifications, the CVR of each item, the content validity index, and the alpha and omega values.

### 8.5 Points to confirm with the adviser

- **Who answers what.** Commuters and drivers answer the SUS and TAM only; Part C goes to the five IT experts (8.1). Confirm that this fits Objective 6 and the college's evaluation format.
- **Original instrument sources.** The SUS items come from Brooke (1996), the TAM usefulness and ease-of-use items from Davis (1989), and the intention items from Venkatesh and Davis (2000). Many colleges allow seminal sources for an adopted instrument even under a five-year rule. Ask the adviser whether these three may be cited. If not, cite only the recent sources in 8.6 and say that the items are the standard SUS and TAM items.
- **"(awkward)" in item 12.** Its only source is Finstad (2006). If the adviser does not allow it, either keep "(awkward)" without a citation, as a wording aid, or drop it and keep the standard "cumbersome".

### 8.6 References (APA 7th edition, 2021 to 2026)

- Altay, B. C., & Okumuş, A. (2022). User adoption of integrated mobility technologies: The case of multimodal trip-planning apps in Turkey. *Research in Transportation Business & Management, 43*, Article 100706. https://doi.org/10.1016/j.rtbm.2021.100706
- Hyzy, M., Bond, R., Mulvenna, M., Bai, L., Dix, A., Leigh, S., & Hunt, S. (2022). System Usability Scale benchmarking for digital health apps: Meta-analysis. *JMIR mHealth and uHealth, 10*(8), Article e37290. https://doi.org/10.2196/37290
- International Organization for Standardization & International Electrotechnical Commission. (2023). *Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model* (ISO/IEC Standard No. 25010:2023).
- Kumar, R. V. (2024). Cronbach's alpha: Genesis, issues and alternatives. *IMIB Journal of Innovation and Management, 2*(2). https://doi.org/10.1177/ijim.241234970
- Marikyan, D., Papagiannidis, S., & Stewart, G. (2023). Technology acceptance research: Meta-analysis. *Journal of Information Science*. Advance online publication. https://doi.org/10.1177/01655515231191177
- Romero Jeldres, M., Díaz Costa, E., & Faouzi Nadim, T. (2023). A review of Lawshe's method for calculating content validity in the social sciences. *Frontiers in Education, 8*, Article 1271335. https://doi.org/10.3389/feduc.2023.1271335
- Vlachogianni, P., & Tselios, N. (2022). Perceived usability evaluation of educational technology using the System Usability Scale (SUS): A systematic review. *Journal of Research on Technology in Education, 54*(3), 392-409. https://doi.org/10.1080/15391523.2020.1867938
- Yuduang, N., Ong, A. K. S., Vista, N. B., Prasetyo, Y. T., Nadlifatin, R., Persada, S. F., Gumasing, M. J. J., German, J. D., Robas, K. P. E., Chuenyindee, T., & Buaphiban, T. (2022). Utilizing structural equation modeling–artificial neural network hybrid approach in determining factors affecting perceived usability of mobile mental health application in the Philippines. *International Journal of Environmental Research and Public Health, 19*(11), Article 6732. https://doi.org/10.3390/ijerph19116732

Before these go into the manuscript, open each one and check the authors, the year and the pages. Marikyan et al. (2023) may have a volume and issue number by now. The page range of Kumar (2024) was not shown online.
