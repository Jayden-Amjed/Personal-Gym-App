# Jayden's project preferences and requirements

Source: explicit project request dated 2026-11-12 (America/Los_Angeles). Preserve the distinction between what Jayden asked for and defaults selected during implementation. Future changes should update this record when the user states a preference; do not infer enduring personal preferences from a one-off implementation choice.

## How I want this project handled

- Keep a GitHub repository with a current PROJECT_STATUS.md, AGENTS.md, workflow notes, and my relevant preferences so future sessions can pick up the work.
- Reuse the Co_op repository's workflow pattern. Do not copy its unrelated project contents.
- Make reasonable assumptions to get an initial working foundation built.
- Use available resources and open-source tools where useful.
- Use the existing public GitHub repository, now named [Jayden-Amjed/Repbook](https://github.com/Jayden-Amjed/Repbook). Public source does not mean my workout, food, or photo data should be public.
- My phone is an iPhone 14. I want a standalone app on its Home Screen, not something that requires the computer to stay on. My phone is connected to the computer; that report alone is not proof of a tested install or launch.

## App requirements

- Opening the app shows basic statistics: workout logs, sets hit this week, a weight graph, a calorie graph, and rep count per day.
- Below the overview, choose the workout gym: El Cajon, Miramar, or Add new gym.
- Selecting a gym opens the workout logging page with Push, Pull, Legs, Upper, and Lower tabs.
- Every exercise supports saving weight and reps so the data can be retrieved later.
- Every exercise has a machine name or N/A because machine resistance feels different across machines.
- Flag missed exercises in the data overview.
- Include food logging and display total calories, fat, protein, and carbohydrates.
- Use mainly black, white, and orange in the interface.

## Requested exercises

| Push | Pull | Legs |
| --- | --- | --- |
| Incline dumbbell press | T-bar rows | Machine leg press |
| Neutral machine press | Cable lat pulldowns | Barbell RDLs |
| Chest flies | Close-lat-pulls machine | Machine leg curls |
| Machine shoulder press | Rear-delt fly | Machine leg extensions |
| Cable lateral raises | Preacher curls | Standing calf machine |
| Cable tricep pushdown | Cable hammer curls | Ab crunch machine |
| Cable tricep overhead | Ab crunch machine | Ab leg raises |
| Ab crunch machine | Ab leg raises | |
| Ab leg raises | | |

The user subsequently specified **Upper**, in this order:

1. T-bar rows
2. Close-lat-pulls machine
3. Incline dumbbell press
4. Chest flies
5. Shoulder press
6. Preacher curls
7. Tricep pushdown
8. Ab crunch machine
9. Ab leg raises

**Lower** is exactly the same as Legs, in the same order. These user-supplied lists supersede the initial plan to infer Upper/Lower routines.

## Feedback after using the app

Recorded: 2026-11-12 (America/Los_Angeles), GYM-002.

- Add rear delts to Pull. The selected exercise is a rear-delt fly after the back exercises; preserve existing session snapshots.
- Start rest automatically after logging a new set. Use editable defaults of 2:30 for compound movements and 1:30 for isolation/abs; editing a recorded set must not restart the timer.
- The desired alert works with the phone locked and music playing through AirPods, saying that the next set is ready. This is a requirement, not a claim that the current web app or Siri has been verified to do it. See [notification setup and limits](NOTIFICATIONS.md).
- Record the exercise/machine order actually logged and prior muscle work so earlier and later sets can be compared when considering progressive overload. Do not equate this context with measured fatigue or true strength.
- Offer an optional photo after finishing each workout. Save it privately with the session date/type and a top-left overlay containing front/back humanoid muscle diagrams followed by the workout label and date, such as `PULL · NOV 12, 2026`.
- Highlight all mapped muscles trained, including assisting muscles, in red. Derive the overlay from exercises with logged sets; planned but missed exercises do not count. The attached sample is test material and must stay outside public source.
- Allow deletion of accidentally started sessions. A photo is optional and must not prevent finishing or preserving a workout.
- Keep the main README generalized, without personal names, gym locations, private app addresses, or machine-specific paths.
- Normal use should not require AI inference or token usage per set/photo. Explain that ordinary app/database/upload requests still occur and distinguish those from AI API calls and hosting costs.

The default rest classifications, anatomical mapping, storage design, and notification provider are implementation choices recorded in [decisions](DECISIONS.md). Actual source, deployment, and phone verification remain in [PROJECT_STATUS](../PROJECT_STATUS.md).

## Communication and recordkeeping

Keep progress and final handoffs concise, actionable, and candid about actual verification. Continue authorized work without repeatedly seeking confirmation. Preserve user data/history and explain material limitations. These operating rules adapt the requested durable Co_op workflow; they do not import its hardware-specific procedures or unrelated personal details.
