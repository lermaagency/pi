import type { LaneSnapshot } from "@earendil-works/pi-agent-core";
import type { TUI } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { ExperimentalChatView } from "../src/experimental/client-tui-chat.ts";
import { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

function createFakeTui(): TUI {
	return { requestRender: () => {} } as unknown as TUI;
}

function snapshot(): LaneSnapshot {
	const args = { brand_id: "brand_home_depot", comparator_brand_ids: ["brand_lowes"] };
	return {
		lane: "main",
		tipId: "e3",
		operation: null,
		queues: [],
		faulted: false,
		configuration: { model: { provider: "faux", modelId: "faux-1" }, thinkingLevel: "off", activeToolNames: [] },
		stats: { messageCount: 3 },
		transcript: [
			{
				id: "e1",
				parentId: null,
				type: "message",
				message: { role: "user", content: "Where does Home Depot stand?", timestamp: 1 },
			},
			{
				id: "e2",
				parentId: "e1",
				type: "message",
				message: {
					role: "assistant",
					content: [{ type: "toolCall", id: "call-1", name: "assess_brand_standing", arguments: args }],
					api: "faux",
					provider: "faux",
					model: "faux-1",
					usage: {
						input: 1,
						output: 1,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 2,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
					stopReason: "toolUse",
					timestamp: 2,
				},
			},
			{
				id: "e3",
				parentId: "e2",
				type: "message",
				message: {
					role: "toolResult",
					toolCallId: "call-1",
					toolName: "assess_brand_standing",
					content: [{ type: "text", text: Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n") }],
					isError: false,
					timestamp: 3,
				},
			},
		],
	} as unknown as LaneSnapshot;
}

describe("experimental chat view tool presentation", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	test("a finished custom tool is one row, and setToolsExpanded reveals arguments and the full result", () => {
		const view = new ExperimentalChatView(createFakeTui(), process.cwd());
		view.apply(snapshot());
		const collapsed = view.transcript.render(120).map(stripAnsi);
		const toolRows = collapsed.filter((line) => line.includes("assess_brand_standing"));
		expect(toolRows).toHaveLength(1);
		expect(toolRows[0]).toContain("✓ assess_brand_standing line 0");
		expect(collapsed.join("\n")).not.toContain("brand_lowes");

		view.setToolsExpanded(true);
		const expanded = stripAnsi(view.transcript.render(120).join("\n"));
		expect(expanded).toContain("arguments");
		expect(expanded).toContain('"brand_lowes"');
		expect(expanded).toContain("line 29");

		view.setToolsExpanded(false);
		expect(stripAnsi(view.transcript.render(120).join("\n"))).not.toContain("brand_lowes");
	});

	test("re-applying an unchanged snapshot does not rebuild finished components", () => {
		const view = new ExperimentalChatView(createFakeTui(), process.cwd());
		view.apply(snapshot());
		const invalidate = vi.spyOn(ToolExecutionComponent.prototype, "invalidate");
		const updateResult = vi.spyOn(ToolExecutionComponent.prototype, "updateResult");
		try {
			view.apply(snapshot());
			expect(invalidate.mock.calls.length).toBe(0);
			expect(updateResult.mock.calls.length).toBe(0);
		} finally {
			invalidate.mockRestore();
			updateResult.mockRestore();
			view.dispose();
		}
	});
});
