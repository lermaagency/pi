import type { TUI } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, test } from "vitest";
import { createCompactToolRenderers } from "../src/core/tools/renderers/compact.ts";
import { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

function createFakeTui(): TUI {
	return { requestRender: () => {} } as unknown as TUI;
}

const largeArgs = {
	skill: "gap-finder",
	content: { headline: "x".repeat(300), what_stands_out: Array.from({ length: 5 }, (_, i) => `observation ${i}`) },
	claims: Array.from({ length: 8 }, (_, i) => ({
		id: `claim_${i}`,
		text: "t".repeat(200),
		evidence_locators: ["a", "b"],
	})),
};
const longResult = Array.from({ length: 40 }, (_, i) => `result line ${i}`).join("\n");

describe("compact tool renderers", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	test("a finished tool collapses to one row plus its separator, and expands to arguments and result", () => {
		const component = new ToolExecutionComponent(
			"save_artifact",
			"tool-1",
			largeArgs,
			{},
			createCompactToolRenderers("save_artifact"),
			createFakeTui(),
			process.cwd(),
		);
		component.markExecutionStarted();
		component.updateResult({ content: [{ type: "text", text: longResult }], isError: false });

		const collapsed = component.render(120).map(stripAnsi);
		expect(collapsed).toHaveLength(2);
		expect(collapsed[0]).toBe("");
		expect(collapsed[1]).toContain("✓ save_artifact");
		expect(collapsed[1]).toContain("result line 0");
		expect(collapsed[1]).not.toContain("result line 1");
		expect(collapsed.join("\n")).not.toContain("claim_0");

		component.setExpanded(true);
		const expanded = stripAnsi(component.render(120).join("\n"));
		expect(expanded).toContain("arguments");
		expect(expanded).toContain('"id": "claim_7"');
		expect(expanded).toContain("result line 39");
		expect(expanded.split("\n").length).toBeGreaterThan(50);
	});

	test("a running tool shows one row with its name and no arguments until expanded", () => {
		const component = new ToolExecutionComponent(
			"read_published_index",
			"tool-2",
			{ brand_id: "brand_home_depot" },
			{},
			createCompactToolRenderers("read_published_index"),
			createFakeTui(),
			process.cwd(),
		);
		component.markExecutionStarted();
		const running = component.render(120).map(stripAnsi);
		expect(running).toHaveLength(2);
		expect(running[1]).toContain("⋯ read_published_index");
		expect(running[1]).not.toContain("brand_home_depot");
		component.setExpanded(true);
		expect(stripAnsi(component.render(120).join("\n"))).toContain('"brand_id": "brand_home_depot"');
	});

	test("an error result keeps the failure glyph and the first line of the typed error", () => {
		const component = new ToolExecutionComponent(
			"save_artifact",
			"tool-3",
			{},
			{},
			createCompactToolRenderers("save_artifact"),
			createFakeTui(),
			process.cwd(),
		);
		component.updateResult({
			content: [
				{
					type: "text",
					text: "save_artifact rejected (evidence_rejected): 2 issue(s)\n- value_mismatch at evidence.0",
				},
			],
			isError: true,
		});
		const [, row] = component.render(120).map(stripAnsi);
		expect(row).toContain("✗ save_artifact");
		expect(row).toContain("rejected (evidence_rejected)");
		expect(row).not.toContain("value_mismatch");
	});
});
