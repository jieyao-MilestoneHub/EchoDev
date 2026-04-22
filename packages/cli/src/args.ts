export interface ParsedArgs {
  readonly command: string;
  readonly positionals: readonly string[];
  readonly flags: ReadonlyMap<string, string | boolean>;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      if (eq !== -1) {
        flags.set(token.slice(2, eq), token.slice(eq + 1));
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags.set(token.slice(2), next);
          i += 1;
        } else {
          flags.set(token.slice(2), true);
        }
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
