import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { BACKGROUND_CONTEXT } from "../../src/harness/context.ts";
import { NodeExecutionEnv } from "../../src/harness/env/nodejs.ts";
import { getOrThrow } from "../../src/harness/types.ts";
import { createTempDir } from "./session-test-utils.ts";

const vanishing = new Set<string>();

// lstat of a path in `vanishing` fails as it would after a concurrent delete.
vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return {
		...actual,
		lstat: async (path: string, ...rest: unknown[]) => {
			if (vanishing.has(path)) {
				const error = new Error(`ENOENT: no such file or directory, lstat '${path}'`) as NodeJS.ErrnoException;
				error.code = "ENOENT";
				throw error;
			}
			return (actual.lstat as (...args: unknown[]) => unknown)(path, ...rest);
		},
	};
});

describe("NodeExecutionEnv.listDir", () => {
	it("skips an entry removed between readdir and lstat", async () => {
		const root = createTempDir();
		writeFileSync(join(root, "session.jsonl"), "{}\n");
		writeFileSync(join(root, "session.jsonl.lock"), "");
		vanishing.add(join(root, "session.jsonl.lock"));
		const env = new NodeExecutionEnv({ cwd: root });
		const entries = getOrThrow(await env.listDir(".", BACKGROUND_CONTEXT));
		expect(entries.map((entry) => entry.name)).toEqual(["session.jsonl"]);
	});
});
