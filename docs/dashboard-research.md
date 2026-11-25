# Dashboard research

Applied to the ABA board portal. The questions in `docs/dashboard-questions.md` come first. These sources decided how those answers should look and behave. Usability outranks decoration: a member who has never seen the page should get the staffing answer without learning a control.

## Principles

### 1. A dashboard is a glance, not a report

Stephen Few's definition: a dashboard is the information needed to meet an objective, on one screen, so it can be monitored at a glance. It shows summaries and exceptions. It does not have to hold every detail, but it should open the door to the detail in one step.

Source: Stephen Few, *Information Dashboard Design* (excerpt, "Monitoring and the Advantage of a Dashboard"). https://public.magendanz.com/Temp/Information%20Dashboard%20Design.pdf

Applied here: four tiles, one chart, and two lists. A person or an event opens in one click. Back is one click.

### 2. Every number needs a comparison, and only the comparison that matters

Few's "Rich Data, Poor Data": a number alone does not say whether things are going well. Compare it with a target, a standard, or the recent past, and do not pile on extra comparisons.

Source: Stephen Few, *Rich Data, Poor Data*. https://www.perceptualedge.com/articles/Whitepapers/Rich_Data_Poor_Data.pdf

Applied here: shifts filled are "of N seats." Events covered are "of N upcoming." The quarter line is this quarter's shift count next to last quarter's. The percent is small context, never the big number. Donny's standing rule matches Few's warning about indirect measures (Common Pitfalls, pitfall 4): say the count, not a ratio by itself. https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf

### 3. Choose three or four measures that answer "is this working?"

GOV.UK's service manual: pick three or four metrics that answer whether the service is working, give them context, and watch them over time.

Source: GOV.UK Service Manual, "How to set performance metrics for your service." https://www.gov.uk/service-manual/measuring-success/how-to-set-performance-metrics-for-your-service

Applied here: shifts filled, events covered, volunteers, and top volunteer. The month chart is the time context.

### 4. Put the answer first, in plain words

The Government Analysis Function tells dashboard authors to use an inverted pyramid (the headline first), short sentences, and no assumption of technical knowledge. GOV.UK's data principles add clarity, a zero baseline, and no reliance on color alone.

Sources:

- Government Analysis Function, "Data visualisation: testing dashboards for design and accessibility." https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-testing-dashboards-for-design-and-accessibility/
- Government Analysis Function, "Writing about data." https://analysisfunction.civilservice.gov.uk/policy-store/writing-about-data/
- GOV.UK Brand, "Data." https://brand.design-system.service.gov.uk/data/

Applied here: headers are "Shifts filled" and "Events that need people," not generated sentences. Each element's accessible name is the question a member would ask. The month bars start at zero. Open seats are also written as "2 open," not only drawn in color.

### 5. Length is the right cue for a quantity

Nielsen Norman Group: a dashboard should answer a question the way a car dashboard answers "am I about to run out of gas?" Length and position are the preattentive cues people can compare accurately. Area and angle are weaker.

Source: Nielsen Norman Group, "Dashboards: Making Charts and Graphs Easier to Understand." https://www.nngroup.com/articles/dashboards-preattentive/

Applied here: shifts by month are bars with the value on the bar. No rings, gauges, or pie charts.

### 6. Gray first, one accent for the thing to act on

Cole Nussbaumer Knaflic: color used everywhere cancels itself out. One difference draws the eye. She also warns that an exploratory dashboard should not paint a single story so hard that other stories disappear. Few's side of the same point: use color sparingly to mark what deserves attention.

Sources:

- Cole Nussbaumer Knaflic, Talks at Google, on dashboards and strategic color. https://www.youtube.com/watch?v=8EMW7io4rSI
- Cole Nussbaumer Knaflic, "declutter your data visualizations" and "strip away the non-essential." https://www.storytellingwithdata.com/blog/2016/3/1/declutter-your-data-visualizations and https://www.storytellingwithdata.com/blog/2019/9/19/strip-away-nonessential
- Stephen Few, Dashboard Design course notes, on simplicity. https://www.perceptualedge.com/files/Dashboard_Design_Course.pdf

Applied here: the page is gray and white. Pine (`#407589`) marks the month total and the open-seat counts, which are the exception a chair acts on. Rank, event type, and example data stay gray so they are not a second story.

### 7. Show the frequent action, disclose the rest

Nielsen Norman Group's progressive disclosure: show the few options people need every time, and put the rare ones one obvious step away. The step must be labeled so people know what they will get. Going past two levels gets people lost.

Source: Nielsen Norman Group, "Progressive Disclosure." https://www.nngroup.com/articles/progressive-disclosure/

Applied here: the first screen is the answers. The second screen is one person or one event. There is no third level and no "More filters" menu. The old group-by control and the multi-select filters were rare, unlabeled in practice, and they hid the answer, so they were removed rather than tucked behind a link.

### 8. Recognition over recall, and the other usability heuristics

Nielsen Norman Group's heuristics, especially recognition rather than recall: people should see their options, not remember a path. Also: show status, speak the user's language, offer an obvious way back, prevent errors with sensible defaults, keep the design sparse, and help people recover when something fails.

Sources:

- Nielsen Norman Group, "10 Usability Heuristics for User Interface Design." https://www.nngroup.com/articles/ten-usability-heuristics/
- Nielsen Norman Group, "Memory Recognition and Recall in User Interfaces." https://www.nngroup.com/articles/recognition-and-recall/

Applied here:

- Pills say "This year," "This quarter," and the event type, with the shift count on the pill.
- This year and All are selected on a first visit. Nothing has to be set up.
- Back is the word Back, not an icon. Rows are large enough to tap.
- Loading and a failed load are written out, and a failed load has Try again.
- The address bar records the period, the event type, and an open detail. It does not record the password, and it does not restore a drill the page no longer shows.

### 9. Consumer summaries: one period, one comparison, don't mix modes

Apple Screen Time leads with a total, then a simple chart, and switches Day or Week with a visible control. Stripe's home states the period and compares it with the previous period, and keeps test data from looking like live money. Shopify's home pairs the overview with the tasks that still need doing.

Sources:

- Apple, "Track app and device usage in Screen Time on Mac." https://support.apple.com/guide/mac-help/track-app-and-device-usage-mchlf2c0c770/mac
- Observed product patterns summarized in "Dashboard Design Examples" (Stripe period and comparison, Shopify tasks). https://designify.design/blog/dashboard-design-examples

Applied here: This year and This quarter are the only period controls. The quarter line is the comparison. Events that still need people are the task list. External attendance sits below, labeled "Example data," and is not mixed into the volunteer counts.

## What this ruled out

Rings, a group-by control, a breadcrumb trail, and a filter drawer all failed at least one rule: they took attention without answering a ranked question, or they made a member remember a path. They are not on the first screen.
