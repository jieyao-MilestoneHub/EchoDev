import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";

export async function readJson(file: string): Promise<unknown> {
  const text = await fs.readFile(file, "utf8");
  return JSON.parse(text) as unknown;
}

export async function atomicWriteJson(file: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, file);
}
