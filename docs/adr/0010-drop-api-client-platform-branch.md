# Drop the api-client platform branch

The `@routess/api-client` factory used to take a `platform: "web" | "mobile"` parameter and branch on it for HTTP-client defaults and auth-state storage. Web was the only adapter that ever actually shipped — `StorageAdapterAuthState` (the mobile-shaped adapter) had no tests, no callers, and depended on a `StorageAdapter` interface that nothing else in the repo used. Per the *one-adapter-means-hypothetical-seam* rule, the platform branch was indirection without payoff. Removed: the `platform` parameter, `StorageAdapterAuthState`, the `StorageAdapter` re-export, and the conditional defaults in `defaultHttpClient` / `defaultAuthStateManager`. The factory now constructs a web client unconditionally.

If a real mobile adapter ever materializes, reintroduce a `platform` parameter (or a separate `createMobileApiClient` factory) at the same time as the second concrete adapter. Two adapters means a real seam.

## Considered options

- **Keep the branch and add a smoke test for the mobile path** — rejected: a smoke test against a no-op `StorageAdapter` doesn't prove the mobile path works in any real environment, and would have to be rewritten when a real mobile app actually arrives. Carrying dead branching just so the test exists is the wrong direction.
- **Move `StorageAdapterAuthState` into a side package for future reuse** — rejected: nothing currently imports it; preserving it "in case" is the same hypothetical seam in a different file. Easier to delete and re-derive when needed.
