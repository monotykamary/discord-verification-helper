# Privacy

The extension operates locally and only when you click **Check requirement** or **Open email re-verification**.

## Data accessed

- The active tab's URL, to check that it is the Discord web app.
- The public client bundle path, to match a reviewed adapter.
- Whether a current user exists, without reading identity fields.
- The required-action value and the relevant native verification-layer state.
- The helper's own rendered control, to confirm the prompt is visible.

The popup receives only a fixed status code, a client bundle path, and (when applicable) `REQUIRE_REVERIFIED_EMAIL`. It does not receive page objects or exception text.

## Data not accessed or retained

The extension does not read login tokens, cookies, local storage, messages, guild membership, email addresses, phone numbers, passwords, or verification codes. It has no storage, analytics, logging backend, telemetry, external messaging, or background monitoring. It makes no direct API requests and downloads no remote code.

The native Discord screen still uses Discord's own code and services. Clicking its controls is an interaction with Discord, governed by Discord's privacy policy, not a data submission to this helper.

Removing the extension stops future access. A page reload removes a locally opened helper wrapper. Neither action reverses verification that you completed with Discord.
