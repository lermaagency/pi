import assert from "node:assert/strict";
import { test } from "node:test";
import { TruncatedText } from "../src/components/truncated-text.ts";
import { visibleWidth } from "../src/utils.ts";

test("truncated text reuses rows until resize or explicit invalidation", () => {
	const text = new TruncatedText(`\u001b[31m${"界 wide text ".repeat(100)}\u001b[0m\nsecond line`, 1, 1);
	const wide = text.render(80);
	assert.equal(text.render(80), wide);
	assert.equal(wide.length, 3);
	assert.ok(wide.every((line) => visibleWidth(line) === 80));
	const narrow = text.render(20);
	assert.notEqual(narrow, wide);
	assert.equal(text.render(20), narrow);
	assert.ok(narrow.every((line) => visibleWidth(line) === 20));
	assert.ok(!narrow.join("\n").includes("second line"));
	text.invalidate();
	const refreshed = text.render(20);
	assert.notEqual(refreshed, narrow);
	assert.deepEqual(refreshed, narrow);
});
