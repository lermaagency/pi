/**
 * Strategy conversation benchmark: 30/50 visible messages plus three tools per answer.
 * From the Pi root:
 * node --import ./packages/coding-agent/src/experimental/source-resolver.ts packages/coding-agent/test/experimental-chat-bench.ts
 * Uses a null terminal; no credentials, network, or physical terminal painting.
 */
import { performance } from "node:perf_hooks";
import type { AgentMessage, LaneSnapshot } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { Container, type Terminal, Text, TuiAltScreen } from "@earendil-works/pi-tui";
import { ExperimentalChatView } from "../src/experimental/client-tui-chat.ts";
import { createChatViewport } from "../src/modes/interactive/chat-viewport.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

class NullTerminal implements Terminal {
	columns = 100;
	rows = 40;
	start(_onInput: (data: string) => void, _onResize: () => void): void {}
	stop(): void {}
	async drainInput(): Promise<void> {}
	write(_data: string): void {}
	get kittyProtocolActive(): boolean {
		return false;
	}
	moveBy(_lines: number): void {}
	hideCursor(): void {}
	showCursor(): void {}
	clearLine(): void {}
	clearFromCursor(): void {}
	clearScreen(): void {}
	setTitle(_title: string): void {}
	setProgress(_active: boolean): void {}
}

initTheme("dark");
const usage = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};
const answer = [
	"## Where the brand stands",
	"The published measurement is a diagnostic baseline. Compare the same audience and period before drawing a conclusion.",
	"### What stands out",
	"- Review the gap against the agreed competitor set.",
	"- Keep unavailable comparisons visible instead of filling them with assumptions.",
	"- Separate measured evidence from the hypotheses that need research.",
	"### Next step",
	"Use customer research to investigate the strongest supported gap. The saved analysis retains its source versions and evidence links.",
].join("\n\n");
const toolNames = ["read_published_index", "assess_brand_standing", "save_artifact"];

for (const visibleMessages of [30, 50]) {
	const terminal = new NullTerminal();
	const tui = new TuiAltScreen(terminal, false, "/tmp/pi-strategy-bench");
	const view = new ExperimentalChatView(tui, process.cwd());
	const snapshot: LaneSnapshot = {
		lane: "main",
		transcript: [],
		tipId: null,
		operation: null,
		queues: [],
		faulted: false,
		configuration: {
			model: { provider: "fixture", modelId: "fixture" },
			thinkingLevel: "off",
			activeToolNames: toolNames,
		},
		stats: { messageCount: 0, usage },
	};
	function append(message: AgentMessage): void {
		const seq = snapshot.transcript.length;
		const id = `entry-${seq}`;
		snapshot.transcript.push({ id, parentId: snapshot.tipId, seq, timestamp: seq, type: "message", message });
		snapshot.tipId = id;
		snapshot.stats.messageCount++;
	}
	for (let turn = 0; turn < visibleMessages / 2; turn++) {
		append({
			role: "user",
			content: "Where does our brand stand, and which gap should we investigate next?",
			timestamp: turn,
		});
		append({
			role: "assistant",
			api: "fixture",
			provider: "fixture",
			model: "fixture",
			usage,
			stopReason: "toolUse",
			timestamp: turn,
			content: toolNames.map((name) => ({
				type: "toolCall",
				id: `${turn}-${name}`,
				name,
				arguments: { brand_id: "brand_fixture" },
			})),
		});
		for (const name of toolNames)
			append({
				role: "toolResult",
				toolCallId: `${turn}-${name}`,
				toolName: name,
				isError: false,
				timestamp: turn,
				content: [
					{
						type: "text",
						text: `Fixture ${name} completed\n${JSON.stringify({ evidence: "structured_data", notes: answer }, null, 2)}`,
					},
				],
			});
		append({
			role: "assistant",
			api: "fixture",
			provider: "fixture",
			model: "fixture",
			usage,
			stopReason: "stop",
			timestamp: turn,
			content: [{ type: "text", text: answer }],
		});
	}
	const editor = new Text("Ask a follow-up…", 1, 1);
	const viewport = createChatViewport({
		document: view.transcript,
		pendingMessages: view.pendingMessages,
		status: view.status,
		editor,
		footer: new Container(),
	});
	view.apply(snapshot);
	tui.setLayoutRoot(viewport.root);
	tui.start();
	try {
		for (let frame = 0; frame < 20; frame++) tui.renderNow();
		console.log(
			JSON.stringify({
				visibleMessages,
				toolCalls: (visibleMessages / 2) * 3,
				journalEntries: snapshot.transcript.length,
				renderedLines: view.transcript.render(terminal.columns).length,
			}),
		);
		function measure(name: string, frames: number, update: (frame: number) => void): void {
			const samples: number[] = [];
			for (let frame = 0; frame < frames; frame++) {
				const start = performance.now();
				update(frame);
				tui.renderNow();
				samples.push(performance.now() - start);
			}
			samples.sort((a, b) => a - b);
			console.log(
				JSON.stringify({
					name,
					medianMs: samples[Math.floor(frames / 2)],
					p95Ms: samples[Math.floor(frames * 0.95)],
				}),
			);
		}
		measure("steady", 100, () => {});
		viewport.transcript.scrollTo(0);
		measure("scroll", 100, () => viewport.transcript.scrollBy(1));
		measure("typing", 100, (frame) => editor.setText(`Follow-up ${"x".repeat(frame + 1)}`));
		const streaming: AssistantMessage = {
			role: "assistant",
			api: "fixture",
			provider: "fixture",
			model: "fixture",
			usage,
			stopReason: "pending",
			timestamp: 1000,
			content: [],
		};
		snapshot.operation = {
			id: "stream",
			kind: "run",
			startedAt: 1000,
			fromTipId: snapshot.tipId,
			status: "running",
			runningTools: [],
			streamingMessage: streaming,
		};
		viewport.transcript.scrollToEnd();
		measure("streaming", 100, (frame) => {
			streaming.content = [{ type: "text", text: `${answer}\n\n${"Additional evidence. ".repeat(frame + 1)}` }];
			view.apply(snapshot);
		});
		measure("resize", 40, (frame) => {
			terminal.columns = frame % 2 === 0 ? 80 : 120;
		});
	} finally {
		view.dispose();
		tui.stop();
	}
}
