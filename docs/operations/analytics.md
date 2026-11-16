# Eidolon analytics

GA4 web stream: **G-BD9DTMF3HC**. The shared loader in `src/analytics/GoogleAnalytics.js` runs on `eidolonrealms.com`, `www.eidolonrealms.com`, and `play.eidolonrealms.com`. Localhost, preview deployments, and other hostnames do not load Google or send events. Both production surfaces use the parent-domain cookie scope, allowing GA4 to follow the browser from the website into the game without inventing a player identifier.

The website's build copies this shared module into its own `dist/`; the game publishes it with `src/`. Each deployment remains independently runnable. Deploying the website does not deploy the game. The game tag appears after the existing game frontend release workflow publishes the new commit.

## Events and definitions

| Event | Meaning | Parameters |
| --- | --- | --- |
| `page_view` | GA4's initial page view on each surface | `site_surface`: `website` or `game` |
| `play_click` | Website link to the game | `cta_location`: `header`, `hero`, `guide`, `closing`, `footer` |
| `gameplay_start` | First server-synchronized character state, once per world session | `player_class` |
| `gameplay_engagement` | Additive foreground, connected, recently active play time | `active_play_seconds`, `player_class` |
| `gameplay_end` | Game destruction/replacement or page exit | `total_active_play_seconds`, `elapsed_session_seconds`, `end_reason`, `player_class` |

All custom events include `site_surface`. The game samples readiness/connectivity once per second and flushes accumulated play time every 30 seconds and when visibility/focus is lost or the session ends. Starts wait for both the first server state and the player's synchronized level. Loading/login screens do not count as gameplay. Hidden tabs, unfocused windows, and reconnect periods do not accrue time. Sixty seconds without pointer, touch, wheel, or keyboard activity ends the active window; the next interaction resumes counting. Only the occurrence of input is observed, never its contents.

`active_play_seconds` is present only on engagement increments. Sum it for total active play time. Do not add `total_active_play_seconds` to that sum: it is a separate session-end summary for duration distributions. Divide summed `active_play_seconds` by `gameplay_start` event count for approximate average active play time per gameplay session over a sufficiently broad reporting window. GA4 sessions and gameplay sessions are distinct; date boundaries and sessions spanning reporting windows affect that ratio.

Reconnects retain the same gameplay session. A full return/navigation and a browser back/forward-cache restoration start new gameplay segments. Disconnect timing is approximate to the one-second sampling interval. Closing/crashing a browser can lose the final unsent increment or end event; periodic increments reduce this loss. This is browser analytics, not a server-side playtime ledger.

GA4's automatically collected engagement metric covers focused page engagement, including the login screen; it is distinct from the custom active gameplay metric. Do not manually send reserved `session_start` or `user_engagement` events, or duplicate GA4's own engagement duration.

## GA4 reporting setup

In **Admin → Data display → Custom definitions**, register:

- Event-scoped dimensions: `site_surface`, `cta_location`, `player_class`, `end_reason`.
- Custom metrics with unit **Seconds**: `active_play_seconds`, `total_active_play_seconds`, `elapsed_session_seconds`.

Use **Realtime** to inspect incoming event names, then **Explore** to compare active play time by class and website-to-game conversion. Custom definitions can take 24–48 hours to become reportable. Consider marking `gameplay_start` as a key event. These property settings require GA4 Editor access and are not configured by a Git push.

Under the web stream's Enhanced measurement settings, disable **Form interactions** and **Site search** for the game stream; login/register forms and query strings are not useful gameplay analytics. The custom integration never sends usernames, emails, passwords, character IDs, session-resume tokens, chat, coordinates, or inventory. Page URLs omit query strings and fragments; referrers retain only the origin. Google signals and advertising personalization are disabled. The normal Google tag still uses analytics cookies and its standard collection behavior. Integrate any site consent-management requirements with the loader before collection; no consent platform is configured by this change.

## Validation

```sh
npm test -- --runTestsByPath tests/GameplayAnalytics.test.js
npm --prefix website run build
npm --prefix website run check:seo
```

Tests use stubbed delivery and a controlled clock, so they do not send synthetic play events to production. Browser checks can inspect the public tag load and collection requests; only access to GA4 can confirm processing inside the property.

References: [GA4 events](https://developers.google.com/analytics/devguides/collection/ga4/events), [custom metrics](https://support.google.com/analytics/answer/14239619), [Google tag privacy settings](https://developers.google.com/tag-platform/security/guides/privacy), [PII guidance](https://support.google.com/analytics/answer/6366371).
