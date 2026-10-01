import { type Context, defineService } from "@earendil-works/chord";

export interface AgentPromptImage {
	type: "image";
	data: string;
	mimeType: string;
}

export interface AgentPromptRequest {
	message: string;
	images: AgentPromptImage[] | null;
}

export interface AgentOperationError {
	code: string;
	message: string;
}

export type AgentOperationResponse =
	| { accepted: true; operationId: string; error: AgentOperationError | null }
	| { accepted: false; operationId: string | null; error: AgentOperationError };

export type AgentQueueResponse =
	| { accepted: true; entryId: string; error: null }
	| { accepted: false; entryId: null; error: AgentOperationError };

/**
 * `requested`: this call wrote the durable cancellation. `already_requested`: an earlier call did.
 * `not_current`: the operation does not own the lane (it already ended, or another one is current),
 * so there is nothing to abort; `currentOperationId` names the lane's open operation, if any.
 */
export type AgentAbortResponse =
	| { outcome: "requested" | "already_requested"; currentOperationId: string }
	| { outcome: "not_current"; currentOperationId: string | null };

export interface AgentSkillRequest {
	name: string;
	additionalInstructions: string | null;
}

export interface AgentCompactionRequest {
	customInstructions: string | null;
}

export interface AgentNavigationRequest {
	targetId: string | null;
	summarize: boolean;
	label: string | null;
	customInstructions: string | null;
}

/** Presentation-safe command facade over the worker-owned main AgentLane. */
export interface AgentController {
	prompt(request: AgentPromptRequest, context: Context): Promise<AgentOperationResponse>;
	/** Deterministically invoke one application-provided skill by name. */
	skill(request: AgentSkillRequest, context: Context): Promise<AgentOperationResponse>;
	requestAbort(operationId: string, context: Context): Promise<AgentAbortResponse>;
	steer(request: AgentPromptRequest, context: Context): Promise<AgentQueueResponse>;
	followUp(request: AgentPromptRequest, context: Context): Promise<AgentQueueResponse>;
	nextRun(request: AgentPromptRequest, context: Context): Promise<AgentQueueResponse>;
	cancelQueued(
		entryId: string,
		context: Context,
	): Promise<{ outcome: "cancelled" | "already_consumed" | "not_found" }>;
	resume(context: Context): Promise<AgentOperationResponse>;
	compact(request: AgentCompactionRequest, context: Context): Promise<AgentOperationResponse>;
	navigate(request: AgentNavigationRequest, context: Context): Promise<AgentOperationResponse>;
}

export const AgentController = defineService<AgentController>("pi.agent-controller");
