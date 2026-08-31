import { handleSquirrelStartup } from "./squirrel-startup";

// Squirrel lifecycle events must finish before the normal desktop runtime is
// loaded. In particular, startup must not initialize PostgreSQL or Next while
// Update.exe is creating or removing Windows shell shortcuts.
if (!handleSquirrelStartup()) {
  void import("./index");
}
