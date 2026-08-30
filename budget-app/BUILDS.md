# CoupleFlow — EAS Builds

Build profiles live in `eas.json`. App identity (bundle id, icons, runtime
version, updates URL) lives in `app.config.ts` — `app.json` is only the base
it spreads over; don't add config to `app.json` directly.

## Profiles

| Profile | Use | Distribution | Notes |
|---|---|---|---|
| `development` | Dev client on a physical device | internal | `developmentClient: true`; JS served by Metro, so it uses your local `.env` at runtime |
| `development-simulator` | Dev client on the iOS simulator | internal | Same as `development` + `ios.simulator` |
| `preview` | Internal testing (TestFlight internal / direct APK install) | internal | Android builds an **APK** for direct install; OTA updates channel `preview` |
| `production` | Store submissions | store | Auto-incremented build numbers (remote version source), Android **app bundle**, OTA updates channel `production` |

## Environment variables

Each profile declares an `environment` (`development` / `preview` /
`production`). EAS loads the matching server-side environment variables at
build time — **local `.env` files are not uploaded to EAS builds.**

Create the variables once per environment (values from `.env.example`):

```sh
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://<prod-api-host>
eas env:create --environment production --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value <id>
eas env:create --environment production --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value <id>
eas env:create --environment production --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value <id>
# repeat for --environment preview with the staging API URL
```

`EXPO_PUBLIC_API_URL` **must** be HTTPS in production; iOS ATS blocks plain
HTTP. The production API host is tracked separately (production deployment
task) — until it exists, production builds will fall back to
`http://localhost:8080` and won't reach a backend.

## Commands

```sh
npx eas-cli build --profile development-simulator --platform ios   # local dev client
npx eas-cli build --profile preview --platform all                 # internal testers
npx eas-cli build --profile production --platform all              # store build
npx eas-cli submit --platform ios                                  # after production build
npx eas-cli update --channel preview                               # OTA update to testers
```

## OTA updates

`expo-updates` is configured (`updates.url` + `runtimeVersion: 1.0.0` in
`app.config.ts`). Builds are pinned to their `channel` (`preview` /
`production`). Ship JS-only fixes with `eas update --channel <channel>`;
bump `runtimeVersion` whenever native code or config changes so old
binaries never load incompatible JS.

## Store submission (still to do before launch)

- `submit.production` in `eas.json` is intentionally minimal — `eas submit`
  prompts for App Store Connect / Play Console credentials on first run and
  stores them with the project.
- Apple: needs an App Store Connect app record + `usesAppleSignIn` capability
  (already in `app.config.ts`).
- Google: first submission must be uploaded manually through the Play Console;
  subsequent ones can use `eas submit` with a service-account key.
