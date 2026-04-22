import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  type DecisionNode,
  type DecisionReader,
  type DecisionWriter,
  parseDecisionNode,
} from "@echodev/core";
import { atomicWriteJson, readJson } from "./io.js";
import { buildIndexes } from "./indexer.js";

export class FileDecisionRepository implements DecisionReader, DecisionWriter {
  private readonly root: string;
  private readonly decisionsDir: string;
  private readonly indexDir: string;

  constructor(repoRoot: string) {
    this.root = path.resolve(repoRoot, ".echodev");
    this.decisionsDir = path.join(this.root, "decisions");
    this.indexDir = path.join(this.root, "index");
  }

  async list(): Promise<readonly DecisionNode[]> {
    await this.ensureLayout();
    const entries = await fs.readdir(this.decisionsDir, { withFileTypes: true });
    const nodes = await Promise.all(
      entries
        .filter((e) => e.isFile() && e.name.endsWith(".json"))
        .map(async (e) =>
          parseDecisionNode(await readJson(path.join(this.decisionsDir, e.name))),
        ),
    );
    return nodes.sort((a, b) => a.id.localeCompare(b.id));
  }

  async get(id: string): Promise<DecisionNode | undefined> {
    await this.ensureLayout();
    try {
      return parseDecisionNode(await readJson(this.fileFor(id)));
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw cause;
    }
  }

  async put(node: DecisionNode): Promise<void> {
    await this.ensureLayout();
    await atomicWriteJson(this.fileFor(node.id), node);
    await this.rebuildIndexes();
  }

  async remove(id: string): Promise<void> {
    await this.ensureLayout();
    try {
      await fs.unlink(this.fileFor(id));
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
    }
    await this.rebuildIndexes();
  }

  async rebuildIndexes(): Promise<void> {
    const { byFile, byModule, graph } = buildIndexes(await this.list());
    await atomicWriteJson(path.join(this.indexDir, "by-file.json"), byFile);
    await atomicWriteJson(path.join(this.indexDir, "by-module.json"), byModule);
    await atomicWriteJson(path.join(this.indexDir, "graph.json"), graph);
  }

  private fileFor(id: string): string {
    return path.join(this.decisionsDir, `${id}.json`);
  }

  private async ensureLayout(): Promise<void> {
    await fs.mkdir(this.decisionsDir, { recursive: true });
    await fs.mkdir(this.indexDir, { recursive: true });
  }
}
