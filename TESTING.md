# Validation record

## Automated

- `npm test`: 36 passing tests covering the page helper and popup integration.
- `npm run check`: manifest capabilities, version consistency, local popup assets, and JavaScript syntax pass.
- `npm run package`: ZIP generated with the six intended extension files and MIT license; archive contents inspected.

The runtime fixture tests that callback abortion leaves no inserted chunk, installed-chunk marker, or factory. Sensitive-data getters and network stubs fail if touched. Opening is tested with fake account state, including synchronous/asynchronous rendering, stale requirements, no requirement, unsupported cases, duplicate layers, timeout rollback, and cleanup.

## Direct browser evidence

- Before packaging, the native Discord component was opened on an already-affected, consenting account with the actual `REQUIRE_REVERIFIED_EMAIL` requirement. The user reported successfully completing verification.
- The packaged `runInDiscord('inspect', ADAPTERS)` function was then executed against the real supported Discord web client through CDP. It returned `no_action`, consistent with completed verification, and the runtime chunk-array length was unchanged.
- No fake required action was injected into the real account to recreate the restricted condition.

## Not yet verified

The extension has **not** been loaded through Chrome's extension installer and tested end-to-end as a toolbar popup on a restricted account. The CDP inspection above tests the actual packaged page function, not Chrome permission/install behavior. Native opening with the added visibility-confirmation wrapper is currently fixture-tested; the original successful account repair used the native component without that wrapper.

Manual unpacked-extension checks are documented in `CONTRIBUTING.md`. No Chrome Web Store submission or acceptance is claimed.

## Structural review

Contour found no policy violations. Its advisory findings were branching in the self-contained guarded page function, popup orchestration, fixture setup, and direct test-to-implementation dependencies. Those branches enforce compatibility and side-effect boundaries; the test imports are intentional. Source witnesses were reviewed rather than rewritten to optimize a metric. Contour's graph resolution and syntax metrics do not certify correctness.
