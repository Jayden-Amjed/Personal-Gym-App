# Rest alerts

Status reviewed: 2026-11-12 (America/Los_Angeles). The Web Push implementation is present, but the production environment check returned revision `0` with no entries. Scheduler/VAPID credentials have not been configured. Locked-phone delivery, music interaction, and AirPods announcements are **not verified**. Check [PROJECT_STATUS](../PROJECT_STATUS.md) for deployment evidence.

The open-app timer starts after each new logged set, using that exercise's rest duration. It stores a deadline on the device, so reopening shows elapsed time instead of restarting the countdown. Enable voice once per visit to test an available on-device voice. Keep Repbook visible for this local alert; a background JavaScript timer cannot provide dependable locked-screen delivery.

## Enable the server path

A maintainer must configure these runtime entries through the existing Site's native environment-variable tool, then redeploy the same private Site to apply the environment revision:

| Entry | Purpose |
| --- | --- |
| `QSTASH_TOKEN` | Owner's QStash credential; store as a secret. |
| `VAPID_PUBLIC_KEY` | Public Web Push application key. |
| `VAPID_PRIVATE_KEY` | Corresponding private key; store as a secret. |
| `VAPID_SUBJECT` | Valid public HTTPS origin identifying the application. |

Generate the VAPID pair in memory with the installed `web-push` package and pass it directly to the runtime configuration tool. Do not print private keys, request that they be pasted into chat, or place credentials in Git or the hosting manifest. Preserve the existing Site, audience, D1 database, and R2 binding. Verify `/api/rest-alerts` reports configured before enabling a phone subscription; configuration alone does not prove delivery.

After a new set saves, Repbook requests a scheduled encrypted Web Push through QStash. The payload is a generic next-set reminder; the scheduler receives encrypted bytes, a push endpoint, and delivery timing, not personal journal/photo contents. Normal app use makes ordinary database/upload requests. These features do not call an AI model or consume OpenAI inference tokens.

At review, [QStash pricing](https://upstash.com/pricing/qstash) lists a free tier of **1,000 messages per day**. The selected account's plan and limits must be checked; this is not a guarantee of perpetual free service, unlimited use, or reliable delivery. Hosting/storage usage is separate.

## Enable and test on iPhone

1. Open the installed Home Screen app on iOS 16.4 or later. After service configuration, tap **Enable notifications** and accept the device prompt. Permission must follow that tap, as described in [Apple's Web Push guide](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).
2. Allow Repbook notifications in iPhone settings and check Focus settings. For speech through compatible AirPods, inspect **Settings → Notifications → Announce Notifications** and enable Repbook if offered. Apple documents this for [supported apps and headphones](https://support.apple.com/en-us/102536); support for this specific Home Screen app must be tested.
3. Log a test set, confirm its save and notification scheduling acknowledgement, play music through AirPods, lock the phone, and verify both delivery timing and spoken content. Repeat with the app open, another app foregrounded, a replacement set, and cancellation. Remove the test session afterward.

Record the actual phone/iOS/headphone combination and results in PROJECT_STATUS. All physical-device cases remain pending; browser emulation and unit tests do not establish them.

## Known limits

- Scheduling acknowledgement means the service accepted the request, not that the phone received or spoke it. Connectivity, OS settings, Focus, and provider delays affect delivery.
- Editing a set does not restart rest. A new set replaces the prior timer; current-device finish/delete sends cancellation. Failed scheduling/cancellation is visible, and failed cancellation is retained for retry. An alert already being delivered may still arrive, and an unknown provider acknowledgement cannot be treated as confirmed cancellation.
- Finishing/deleting on another device does not currently revoke a push already queued for the original device. A stale notification can therefore arrive; this needs server reconciliation before cross-device cancellation can be promised.
- In-app speech pauses for a set once its push scheduling is acknowledged to avoid duplicate alerts. Siri announcements are controlled by iOS, not by Repbook.
- Photo overlays, workout logging, and local timer operation remain available without a QStash subscription. The UI states that locked-screen alerts require service setup until credentials exist.
