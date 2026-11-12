# Install Repbook on iPhone

The hosted app works independently of the computer. It is a home-screen web app, not an App Store binary.

1. On the iPhone 14, open the deployed Repbook link in **Safari**.
2. Sign in with the same ChatGPT account that owns this private app.
3. Tap **Share**, then **Add to Home Screen**. If offered, enable **Open as Web App**.
4. Tap **Add**. Launch **Repbook** from its home-screen icon.

The manifest requests a standalone app window and supplies an Apple touch icon. Installation needs this action on the iPhone; connecting it to the Windows computer does not install the app.

Internet access is needed to load the journal and sync the private database. The app keeps pending edits locally for recovery, but this first version does not promise a full offline cold launch. Keep the app open until it reports saved. Export a JSON backup periodically from the app.

Platform references: [MDN installation guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing), [standalone app display](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Create_a_standalone_app).
