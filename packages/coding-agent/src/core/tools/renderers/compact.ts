/**
 * Compact presentation for tools without a bespoke renderer.
 *
 * One row by default: status glyph, tool name, and the first line of the result. Expansion
 * (mouse, or the app.tools.expand key) reveals the pretty-printed arguments and the full
 * result. The tool renders its own framing, so a collapsed tool costs one row plus the
 * separator line the component adds.
 */

import { Container, Text, TruncatedText } from "@earendil-works/pi-tui";
import { keyHint } from "../../../modes/interactive/components/keybinding-hints.ts";
import type { Theme } from "../../../modes/interactive/theme/theme.ts";
import type { ToolDefinition } from "../../extensions/types.ts";
import { getTextOutput } from "../render-utils.ts";

export type CompactToolRenderers = Pick<ToolDefinition<any, any>, "renderCall" | "renderResult"> & {
	readonly renderShell: "self";
};

const MAX_ARGUMENT_CHARS = 20_000;

function formatArguments(args: unknown): string {
	let text: string;
	try {
		text = JSON.stringify(args, null, 2) ?? "";
	} catch {
		text = String(args);
	}
	return text.length > MAX_ARGUMENT_CHARS ? `${text.slice(0, MAX_ARGUMENT_CHARS)}\n…` : text;
}

function hidden(): Container {
	return new Container();
}

export function createCompactToolRenderers(toolName: string): CompactToolRenderers {
	return {
		renderShell: "self",
		renderCall(args, theme: Theme, context) {
			// Once a final result exists the result row carries the name; this row hides.
			if (!context.isPartial) return hidden();
			const glyph = context.executionStarted ? theme.fg("muted", "⋯") : theme.fg("muted", "·");
			const row = `${glyph} ${theme.fg("toolTitle", theme.bold(toolName))}`;
			if (!context.expanded) return new TruncatedText(row, 0, 0);
			return new Text(`${row}\n${theme.fg("toolOutput", formatArguments(args))}`, 0, 0);
		},
		renderResult(result, options, theme: Theme, context) {
			if (options.isPartial) return hidden();
			const output = getTextOutput(result, context.showImages).trim();
			const glyph = context.isError ? theme.fg("error", "✗") : theme.fg("success", "✓");
			const summary = output.split("\n")[0] ?? "";
			const title = `${glyph} ${theme.fg("toolTitle", theme.bold(toolName))}`;
			if (!options.expanded) {
				const hint = keyHint("app.tools.expand", "to expand");
				return new TruncatedText(
					`${title} ${theme.fg("toolOutput", summary)} ${theme.fg("muted", "(")}${hint}${theme.fg("muted", ")")}`,
					0,
					0,
				);
			}
			const lines = [
				title,
				theme.fg("muted", "arguments"),
				theme.fg("toolOutput", formatArguments(context.args)),
				theme.fg("muted", "result"),
				...output.split("\n").map((line) => theme.fg("toolOutput", line)),
			];
			return new Text(lines.join("\n"), 0, 0);
		},
	};
}
