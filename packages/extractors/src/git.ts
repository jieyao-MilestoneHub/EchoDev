import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface CommitInfo {
  readonly sha: string;
  readonly author: string;
  readonly date: string;
  readonly subject: string;
  readonly body: string;
  readonly changedFiles: readonly string[];
  readonly diff: string;
}

const SEP = "\x1f";
const END = "\x1e";

export async function getCommit(repoRoot: string, ref: string): Promise<CommitInfo> {
  const fmt = `%H${SEP}%an${SEP}%ad${SEP}%s${SEP}%b${END}`;
  const { stdout: meta } = await run(
    "git",
    ["log", "-1", "--date=short", `--format=${fmt}`, ref],
    { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 },
  );
  const record = meta.split(END)[0] ?? "";
  const [sha, author, date, subject, body] = record.split(SEP);
  const { stdout: filesOut } = await run(
    "git",
    ["show", "--name-only", "--pretty=format:", ref],
    { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 },
  );
  const { stdout: diff } = await run(
    "git",
    ["show", "--no-color", "--format=", ref],
    { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024 },
  );
  const changedFiles = filesOut
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return {
    sha: sha ?? ref,
    author: author ?? "",
    date: date ?? "",
    subject: subject ?? "",
    body: body ?? "",
    changedFiles,
    diff,
  };
}
