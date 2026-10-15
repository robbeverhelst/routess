import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Registers happy-dom's window, document and DOM globals for `bun test`.
// Preloaded before setup.ts (bunfig.toml), which needs a DOM to exist.
GlobalRegistrator.register({ url: "http://localhost:3000" });
