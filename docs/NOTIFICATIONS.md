# Rest alerts

Status reviewed: 2026-11-12 (America/Los_Angeles), GYM-003. EU QStash authentication passed a read-only API check. Four runtime values are stored as secrets at environment revision `1`, and saved version 2 was redeployed with that revision.

The first phone test failed: `/api/rest-alerts` returned 503 because QStash rejected `Upstash-Redact-Fields: body, headers` with HTTP400. A corrected direct request using `body, header[Authorization]` returned201, and the owner confirmed a push notification arrived without speech. The owner then requested removing all voice features and keeping standard push notifications. **This direct test does not establish the live app's automatic Log set path:** it still needs the source fix deployed. See [PROJECT_STATUS](../PROJECT_STATUS.md) for the source-publishing blocker and exact release evidence.

The countdown belongs inside the exercise card for the newly logged set and remains available across app tabs. It uses a stored deadline, so returning to the app reflects elapsed time. There is no speech synthesis or voice-enable/test/mute control in the GYM-003 source. Push notifications remain the locked-screen alert mechanism.

## Server configuration

Configure these entries through the existing Site's native environment-variable tool, then redeploy the same private Site to apply the environment revision:

| Entry | Purpose |
| --- | --- |
| `QSTASH_TOKEN` | Owner's EU-region QStash credential; store as a secret. |
| `VAPID_PUBLIC_KEY` | Public Web Push application key. |
| `VAPID_PRIVATE_KEY` | Corresponding private key; store as a secret. |
| `VAPID_SUBJECT` | Valid public HTTPS origin identifying the application. |

Keep the existing VAPID pair after subscribing devices. Generate keys in memory only when initially configuring or deliberately rotating them. Do not print private keys, request them in chat, or put credentials in Git or the hosting manifest. Preserve the existing Site, audience, D1 database, and R2 binding.

The sender uses `https://qstash.upstash.io` (EU). A token from another region requires a matching endpoint change. Each saved new set requests an encrypted Web Push. The scheduler receives encrypted bytes, a push endpoint, and timing, not journal/photo contents. `Upstash-Redact-Fields` must use the provider-accepted `body, header[Authorization]` syntax; the blanket `headers` option was rejected by the real API.

Apple instructs senders not to refresh a VAPID JWT more than hourly. GYM-003 adds a D1 cache scoped by public key, push-service origin, and subject, with a 12-hour expiry and refresh after 11 hours. Atomic upsert selects one token across concurrent Worker instances; payload encryption remains fresh per message. The cache stores an expiring signed authorization, never its private signing key. Apply migration `0002_vapid_token_cache.sql` through publication before serving that source.

At review, [QStash pricing](https://upstash.com/pricing/qstash) lists a free tier of **1,000 messages per day**. The owner selected the free setup; the agent enabled no billing and did not independently inspect the account's plan. Hosting/storage limits are separate. No AI model is called by these features.

## Enable and test on iPhone

1. Open Repbook from its installed Home Screen icon on iOS16.4 or later. Tap **Enable notifications** and accept the device prompt. Subscription must follow that gesture, as described in [Apple's Web Push guide](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).
2. Allow Repbook notifications in iPhone settings and check Focus settings.
3. After the corrected app source is deployed, log a test set and confirm **Notification scheduled**. Play music, lock the phone, and verify push arrival. Repeat with another app foregrounded, a replacement set, and cancellation. Remove the test session afterward.

Record actual results in PROJECT_STATUS. Direct provider-test delivery, app scheduling, and cancellation are separate evidence. Spoken announcements are no longer part of acceptance.

## Known limits

- The source fix is prepared but not deployed while Sites Git returns `sites_git_client_upgrade_required`. The live app still has the rejected privacy-header option.
- Scheduling acknowledgement means the service accepted the request, not that the phone received it. Connectivity, Focus, OS settings, and provider delays affect delivery.
- Editing a set does not restart rest. A new set replaces the prior timer; current-device finish/delete sends cancellation. Failed cancellation is retained for retry. An alert already being delivered may still arrive; an unknown provider acknowledgement cannot be treated as confirmed cancellation.
- Finishing/deleting on another device does not currently revoke a push already queued for the original device. A stale notification can therefore arrive.
- Photos, logging, and the countdown remain available without the notification service.
