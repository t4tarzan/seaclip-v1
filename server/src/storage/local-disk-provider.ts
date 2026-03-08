/**
 * Local filesystem storage implementation.
 *
 * Stores objects as files under a configurable base directory.
 * Keys can include "/" separators — they are mapped to subdirectories.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type {
  StorageProvider,
  PutObjectOptions,
  GetObjectResult,
  ListObjectsOptions,
  ListObjectsResult,
  StorageObject,
} from "./types.js";
import { notFound } from "../errors.js";

export class LocalDiskProvider implements StorageProvider {
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = path.resolve(basePath);
  }

  private keyToPath(key: string): string {
    // Prevent path traversal attacks
    const normalized = key.replace(/\.\./g, "").replace(/^\/+/, "");
    return path.join(this.basePath, normalized);
  }

  private pathToKey(filePath: string): string {
    return path.relative(this.basePath, filePath).replace(/\\/g, "/");
  }

  private metaPath(key: string): string {
    return this.keyToPath(key) + ".meta.json";
  }

  private async ensureDir(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  async putObject(
    key: string,
    body: Buffer | string,
    options: PutObjectOptions = {},
  ): Promise<void> {
    const filePath = this.keyToPath(key);
    await this.ensureDir(filePath);

    const buf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    await fs.writeFile(filePath, buf);

    // Write metadata sidecar
    const meta = {
      contentType: options.contentType ?? "application/octet-stream",
      metadata: options.metadata ?? {},
      size: buf.length,
      storedAt: new Date().toISOString(),
    };

    await fs.writeFile(this.metaPath(key), JSON.stringify(meta, null, 2), "utf8");
  }

  async getObject(key: string): Promise<GetObjectResult> {
    const filePath = this.keyToPath(key);

    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(filePath);
    } catch {
      throw notFound(`Storage object "${key}" not found`);
    }

    const body = await fs.readFile(filePath);

    // Try to read metadata sidecar
    let contentType: string | undefined;
    let metadata: Record<string, string> | undefined;
    try {
      const raw = await fs.readFile(this.metaPath(key), "utf8");
      const parsed = JSON.parse(raw) as {
        contentType?: string;
        metadata?: Record<string, string>;
      };
      contentType = parsed.contentType;
      metadata = parsed.metadata;
    } catch {
      // No metadata sidecar — ignore
    }

    return {
      body,
      contentType,
      metadata,
      size: stat.size,
      lastModified: stat.mtime,
    };
  }

  async deleteObject(key: string): Promise<void> {
    const filePath = this.keyToPath(key);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore ENOENT
    }
    try {
      await fs.unlink(this.metaPath(key));
    } catch {
      // Ignore ENOENT
    }
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await fs.access(this.keyToPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async listObjects(options: ListObjectsOptions = {}): Promise<ListObjectsResult> {
    const { prefix = "", maxKeys = 1000 } = options;

    const objects: StorageObject[] = [];

    async function walk(dir: string, base: string): Promise<void> {
      let entries: any[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true }) as any[];
      } catch {
        return;
      }

      for (const entry of entries) {
        if (objects.length >= maxKeys) break;

        // Skip metadata sidecar files
        if (entry.name.endsWith(".meta.json")) continue;

        const fullPath = path.join(dir, entry.name);
        const key = path.join(base, entry.name).replace(/\\/g, "/");

        if (entry.isDirectory()) {
          await walk(fullPath, key);
        } else if (entry.isFile()) {
          if (prefix && !key.startsWith(prefix)) continue;

          const stat = await fs.stat(fullPath).catch(() => null);
          if (stat) {
            objects.push({
              key,
              size: stat.size,
              lastModified: stat.mtime,
            });
          }
        }
      }
    }

    await walk(this.basePath, "");

    return {
      objects: objects.slice(0, maxKeys),
      hasMore: objects.length >= maxKeys,
    };
  }
}
