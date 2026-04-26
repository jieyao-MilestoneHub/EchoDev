export interface ParsedArgs {
  readonly command: string;
  readonly positionals: readonly string[];
  readonly flags: ReadonlyMap<string, string | boolean>;
}

// Flags that never take a value. Listed here so the parser doesn't greedily
// consume the next positional as their "value" — e.g. `recall --from-stdin
// "src/foo.ts"` must parse as `{from-stdin: true, positional: "src/foo.ts"}`,
// not `{from-stdin: "src/foo.ts"}`.
const BOOL_FLAGS: ReadonlySet<string> = new Set([
  "help",
  "no-claude",
  "purge",
  "force",
  "stdin",
  "from-stdin",
  "quiet",
  "explain",
  "if-expired-block",
]);

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      if (eq !== -1) {
        flags.set(token.slice(2, eq), token.slice(eq + 1));
        continue;
      }
      const name = token.slice(2);
      if (BOOL_FLAGS.has(name)) {
        flags.set(name, true);
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(name, next);
        i += 1;
      } else {
        flags.set(name, true);
      }
    } else {
      positionals.push(token);
    }
  }
  const [command = "help", ...rest] = positionals;
  return { command, positionals: rest, flags };
}

export function flagString(args: ParsedArgs, key: string): string | undefined {
  const v = args.flags.get(key);
  return typeof v === "string" ? v : undefined;
}

export function flagBool(args: ParsedArgs, key: string): boolean {
  return args.flags.get(key) === true || args.flags.get(key) === "true";
}
