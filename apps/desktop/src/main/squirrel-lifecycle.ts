import path from "node:path";

export type SquirrelLifecyclePlan =
  | { kind: "update"; executable: string; args: ["--createShortcut" | "--removeShortcut", string] }
  | { kind: "quit" }
  | { kind: "normal" };

export function resolveSquirrelLifecycle(
  platform: NodeJS.Platform,
  argv: readonly string[],
  execPath: string,
): SquirrelLifecyclePlan {
  if (platform !== "win32") return { kind: "normal" };

  const command = argv[1];
  const target = path.basename(execPath);
  const executable = path.resolve(path.dirname(execPath), "..", "Update.exe");
  if (command === "--squirrel-install" || command === "--squirrel-updated") {
    return { kind: "update", executable, args: ["--createShortcut", target] };
  }
  if (command === "--squirrel-uninstall") {
    return { kind: "update", executable, args: ["--removeShortcut", target] };
  }
  if (command === "--squirrel-obsolete") return { kind: "quit" };
  return { kind: "normal" };
}
