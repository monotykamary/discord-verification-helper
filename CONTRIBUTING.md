# Contributing

Keep this tool small, auditable, and fail-closed. Use conventional commit subjects, for example `fix: guard a changed verification component`.

## Before proposing an adapter

1. Inspect the new public Discord bundle and the exact initialization/cleanup order of its runtime callback.
2. Identify the required-action store, current-user presence check, native verification component, layer manager, JSX runtime, and layer component. Do not broadly enumerate authentication data or ask users for tokens.
3. Add a reviewed exact bundle path in `extension/adapters.js`. Never replace the allowlist with a wildcard.
4. Confirm the component's effects before mounting it. This release must not send mail or submit verification on mount.
5. Add regression cases for unknown builds, changed shapes, stale requirements, unsupported actions, native-layer duplication, and cleanup.
6. Run `npm test`, `npm run check`, and `npm run package`.

Changes that fabricate `required_action`, patch account verification flags, bypass a CAPTCHA, use a session token, send verification requests automatically, or weaken origin/build checks are outside this project's scope.

## Manual Chrome checks

Load `extension/` unpacked in a test profile. Check:

- A non-Discord page refuses injection.
- A signed-out or not-yet-loaded Discord page explains what is missing.
- An unrestricted account reports no action and does not open a screen.
- An unknown build refuses to guess.
- On an already-affected, consenting account with the supported requirement, opening shows the real **Re-verify by Email** button. The account owner completes the next steps.
- Repeated invocations do not duplicate the UI; a normal reload removes the local wrapper.

Do not deliberately restrict a real account or dispatch fake server actions into one just to test success. Use fixtures for the restricted-state test cases. Chrome permission/install behavior must also be checked in an actual loaded extension before claiming an end-to-end extension release test; a CDP invocation of the page function is not the same test.

## Reports and reviews

Include the helper version, Chrome version, client bundle filename, and the helper's fixed status. No account identifiers, email, phone, HAR files, tokens, or codes. Redact screenshots. Review the permission manifest and privacy claims whenever behavior changes.

The PR template includes the expected evidence. Do not claim a browser/store release test that was not performed. Publication and Web Store submission require the maintainer's explicit approval.
