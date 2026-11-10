import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Message } from "@earendil-works/pi-ai";
import {
  EXIT_CODE,
  PER_TASK_OUTPUT_CAP,
  type SingleResult,
  type SubAgentToolContext,
} from "../schema/types.ts";

export type { SingleResult };

export function getFinalOutput(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      const text = msg.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      if (text) return text;
    }
  }
  return "";
}

export function isFailedResult(result: SingleResult): boolean {
  return (
    result.exitCode !== EXIT_CODE.SUCCESS ||
    result.stopReason === "error" ||
    result.stopReason === "aborted"
  );
}

export function getResultOutput(result: SingleResult): string {
  if (!isFailedResult(result)) {
    return getFinalOutput(result.messages) || "(no output)";
  }

  const diagnostics = [
    result.exitCode >= 0 ? `exit code: ${result.exitCode}` : undefined,
    result.exitSignal ? `signal: ${result.exitSignal}` : undefined,
    result.stopReason ? `stopReason: ${result.stopReason}` : undefined,
  ].filter(Boolean);
  const lines = [
    `Child failed${diagnostics.length ? ` (${diagnostics.join("; ")})` : ""}.`,
  ];
  if (result.errorMessage?.trim()) lines.push(`Error: ${result.errorMessage}`);
  if (result.stderr?.trim() && result.stderr !== result.errorMessage) {
    lines.push(`stderr: ${result.stderr}`);
  }
  if (result.reportPath && !result.diagnosticsError) {
    lines.push(`Persisted report: ${result.reportPath}`);
  }
  const report = getFinalOutput(result.messages);
  if (report.trim()) {
    lines.push(
      `PARTIAL/UNVERIFIED completed assistant text (verify consequential claims):\n${truncateParallelOutput(report)}`,
    );
  } else {
    lines.push("No completed assistant text available.");
  }
  return lines.join("\n\n");
}

export function truncateParallelOutput(output: string): string {
  const byteLength = Buffer.byteLength(output, "utf8");
  if (byteLength <= PER_TASK_OUTPUT_CAP) return output;

  let truncated = output.slice(0, PER_TASK_OUTPUT_CAP);
  while (Buffer.byteLength(truncated, "utf8") > PER_TASK_OUTPUT_CAP) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}\n\n[Output truncated: ${byteLength - Buffer.byteLength(truncated, "utf8")} bytes omitted. Full output preserved in tool details.]`;
}

type ToolCallDisplayItem = {
  type: "toolCall";
  name: string;
  args: Record<string, unknown>;
};

type TextDisplayItem = { type: "text"; text: string };

export type DisplayItem = TextDisplayItem | ToolCallDisplayItem;

export function messageContentToDisplayItem(
  messageContent: AssistantMessage["content"][number],
): DisplayItem | null {
  switch (messageContent.type) {
    case "text":
      return { type: "text", text: messageContent.text };
    case "toolCall":
      return {
        type: "toolCall",
        name: messageContent.name,
        args: messageContent.arguments,
      };
    default:
      return null;
  }
}

export function getDisplayItems(messages: Message[]): DisplayItem[] {
  return messages
    .filter((msg): msg is AssistantMessage => msg.role === "assistant")
    .flatMap((msg) => msg.content)
    .map(messageContentToDisplayItem)
    .filter((item): item is DisplayItem => item !== null);
}

export function createTextResult(
  subAgentContext: SubAgentToolContext,
  text: string,
  results: SingleResult[],
  terminate: boolean = false,
  isError: boolean = false,
): AgentToolResult<unknown> {
  const paths = results.flatMap((r) =>
    r.manifestPath
      ? [`${r.agent}${r.step ? ` (step ${r.step})` : ""}: ${r.manifestPath}`]
      : [],
  );
  const diagnostics = paths.length
    ? `\n\nRun diagnostics:\n${paths.join("\n")}`
    : "";
  return {
    content: [
      {
        type: "text",
        text: text + diagnostics,
      },
    ],
    details: subAgentContext.details.make(results),
    terminate,
    ...(isError ? { isError: true } : {}),
  };
}
