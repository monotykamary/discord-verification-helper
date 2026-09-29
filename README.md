# Discord Verification Helper

A small, MIT-licensed Chrome extension that restores a missing **native email re-verification prompt** in Discord's web app.

This is an independent troubleshooting tool, **not an account unlocker or verification bypass**. It does not remove restrictions, solve CAPTCHAs, or manufacture a verification requirement. Discord performs the verification; you complete it yourself.

## Why it exists

An affected account could sign in and connect to Discord's gateway, but message requests returned HTTP `403` / Discord `40002`:

> You need to verify your account in order to perform this action.

The account's email and phone were already marked verified. The missing clue was the client's actual required action: `REQUIRE_REVERIFIED_EMAIL`. Opening Discord's existing verification component exposed **Re-verify by Email**, which resolved the reported issue after the user completed the flow.

The root cause of Discord failing to show that screen is not established. `40002` alone does not prove that this extension applies to your account.

## Install locally

1. Download `discord-verification-helper-0.1.0.zip` from [GitHub Releases](https://github.com/monotykamary/discord-verification-helper/releases/latest) and extract it, or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked**. For the release ZIP, select the extracted folder containing `manifest.json`. For a source checkout, select **`extension/`**, not the repository root.
4. Open your signed-in Discord tab at <https://discord.com/channels/@me>.
5. Click the extension icon, then **Check requirement**.
6. If supported, click **Open email re-verification**.
7. Close the extension popup. Complete **Re-verify by Email** in Discord itself.

No build, npm install, or API key is required to load the extension. It has not been submitted to the Chrome Web Store. Web Store acceptance is not guaranteed.

## Deliberate limits

- Only `https://discord.com/channels/...` in the top frame is supported—not desktop, PTB, Canary, or lookalike domains.
- Version `0.1.0` supports **only** `REQUIRE_REVERIFIED_EMAIL` on the reviewed bundle `/assets/web.d4c7976eccf337f1.js`.
- Unknown builds and other required actions fail closed. Discord updates frequently; this may need a newly reviewed adapter soon.
- If Discord reports no required action, nothing is opened. This does not prove that every account restriction is cleared.
- An already-registered verification layer is not duplicated or replaced, even if Discord fails to display it.
- The helper never sends an email, clicks a verification control, submits a code, changes an account flag, or logs you out.
- Reloading Discord removes the local UI change. It does not undo verification you actually completed.
- Discord's native UI remains responsible for its own normal network traffic, including analytics and subsequent user-requested verification.

If unsupported or still blocked, use [Discord Support](https://support.discord.com/hc/en-us/requests/new). Never share your password, session token, recovery codes, or unredacted network captures.

## Permissions and privacy

Only two Chrome permissions:

| Permission | Purpose |
| --- | --- |
| `activeTab` | Temporary access to the tab where you invoke the extension. |
| `scripting` | Run the packaged, guarded helper in that tab's main frame. |

No background worker, content scripts, host permissions, debugger permission, storage, telemetry, remote code downloads, or automatic monitoring. The popup receives only a fixed status, supported required-action name, and client bundle path. See [PRIVACY.md](PRIVACY.md).

## How it works

1. The popup calls `chrome.scripting.executeScript` only after a user clicks a button.
2. `runInDiscord` checks the exact origin, app route, top frame, and reviewed bundle.
3. A bounded runtime probe captures the existing Rspack runtime. Its callback throws a private sentinel **before** chunk insertion or installed-chunk bookkeeping on the reviewed build. No dummy chunk, module, or runtime reference is left on the page.
4. The helper reads only the adapter's cached modules. It never scans the whole module cache, initializes extra modules, accesses authentication stores, or reads identity fields.
5. It checks `UserRequiredActionStore.getAction()` and the presence of a current user. It does not write either value.
6. On explicit **Open**, it rechecks the requirement and uses the native layer manager, JSX runtime, layer component, and verification component.
7. It confirms a visible native button under its own wrapper within two seconds. If rendering fails, it attempts to remove only its own layer. Observers and timers are cleaned up.

Module IDs are private implementation details, not a supported Discord API. The bundle allowlist is a compatibility guard, **not** a cryptographic integrity guarantee or security boundary against a compromised Discord page.

## Development

Node.js 22+; no third-party dependencies.

```sh
npm test
npm run check
npm run package
```

Packaging also requires the `zip` command (available on macOS and many Linux systems). It writes `dist/discord-verification-helper-0.1.0.zip` containing only the extension files and MIT license.

Tests serialize the injected function exactly as Chrome does, exercise a Rspack-contract fixture, and cover popup wiring, origin/build checks, unsupported actions, stale state, duplicate prevention, visibility confirmation, rollback, observer cleanup, and forbidden credential/network access. They do not place a real account into a restricted state. See [CONTRIBUTING.md](CONTRIBUTING.md) for live-testing boundaries.

## License and affiliation

[MIT](LICENSE). This license covers the helper's original code, not Discord's client. Discord is a trademark of its respective owner. This project is not affiliated with or endorsed by Discord. Use of undocumented client internals carries compatibility and account-policy risks; review Discord's current terms before use.
