import { describe, expect, it } from "vitest";
import type { Message } from "@earendil-works/pi-ai";
import {
  createTextResult,
  getDisplayItems,
  getFinalOutput,
  getResultOutput,
  isFailedResult,
  truncateParallelOutput,
} from "./result.ts";
import {
  EXIT_CODE,
  PER_TASK_OUTPUT_CAP,
  type SingleResult,
  type SubAgentToolContext,
  type SubagentDetails,
} from "../schema/types.ts";

const makeMessage = (
  role: Message["role"],
  text: string,
  extras: Partial<Message> = {},
): Message =>
  ({
    role,
    content: [{ type: "text", text }],
    ...extras,
  }) as unknown as Message;

const stubContext = (): SubAgentToolContext => ({
  config: {} as SubAgentToolContext["config"],
  details: {
    make: (results: SingleResult[]) =>
      ({
        mode: "single",
        agentScope: "user",
        projectAgentsDir: null,
        results,
      }) as SubagentDetails,
  },
});

describe("getFinalOutput", () => {
  it("returns the last assistant text", () => {
    const messages: Message[] = [
      makeMessage("user", "hello"),
      makeMessage("assistant", "first"),
      makeMessage("assistant", "second"),
    ];
    expect(getFinalOutput(messages)).toBe("second");
  });

  it("skips non-text assistant content", () => {
    const messages: Message[] = [
      makeMessage("assistant", "text"),
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            name: "read",
            arguments: {},
            callId: "1",
          },
        ],
      } as unknown as Message,
    ];
    expect(getFinalOutput(messages)).toBe("text");
  });

  it("returns empty string when there are no messages", () => {
    expect(getFinalOutput([])).toBe("");
  });
});

describe("isFailedResult", () => {
  it("is true for non-zero exit code", () => {
    expect(isFailedResult({ exitCode: EXIT_CODE.FAILED } as SingleResult)).toBe(
      true,
    );
  });

  it("is true for stopReason error", () => {
    expect(
      isFailedResult({
        exitCode: EXIT_CODE.SUCCESS,
        stopReason: "error",
      } as SingleResult),
    ).toBe(true);
  });

  it("is true for stopReason aborted", () => {
    expect(
      isFailedResult({
        exitCode: EXIT_CODE.SUCCESS,
        stopReason: "aborted",
      } as SingleResult),
    ).toBe(true);
  });

  it("is false for success", () => {
    expect(
      isFailedResult({
        exitCode: EXIT_CODE.SUCCESS,
        stopReason: "end",
      } as SingleResult),
    ).toBe(false);
  });
});

describe("getResultOutput", () => {
  it("returns final output on success", () => {
    const result = {
      exitCode: EXIT_CODE.SUCCESS,
      messages: [makeMessage("assistant", "done")],
    } as SingleResult;
    expect(getResultOutput(result)).toBe("done");
  });

  it("reports an opaque nonzero exit with toolUse and no stderr without inventing a cause", () => {
    const result = {
      exitCode: EXIT_CODE.FAILED,
      stopReason: "toolUse",
      messages: [],
      stderr: "",
      reportPath: "/runs/report.md",
    } as unknown as SingleResult;
    const output = getResultOutput(result);
    expect(output).toContain("exit code: 1; stopReason: toolUse");
    expect(output).toContain("No completed assistant text available.");
    expect(output).toContain("Persisted report: /runs/report.md");
    expect(output).not.toContain("timeout");
  });

  it("keeps a completed assistant report on timeout alongside reason and signal", () => {
    const result = {
      exitCode: EXIT_CODE.FAILED,
      exitSignal: "SIGTERM",
      stopReason: "error",
      errorMessage: "Subagent exceeded 30s deadline",
      messages: [makeMessage("assistant", "usable findings")],
      stderr: "diagnostic tail",
      reportPath: "/runs/report.md",
    } as SingleResult;
    const output = getResultOutput(result);
    expect(output).toContain(
      "exit code: 1; signal: SIGTERM; stopReason: error",
    );
    expect(output).toContain("Error: Subagent exceeded 30s deadline");
    expect(output).toContain("stderr: diagnostic tail");
    expect(output).toContain("PARTIAL/UNVERIFIED completed assistant text");
    expect(output).toContain("usable findings");
    expect(output).toContain("Persisted report: /runs/report.md");
  });

  it("caps large failed reports and keeps the report pointer ahead of truncated content", () => {
    const result = {
      exitCode: EXIT_CODE.FAILED,
      messages: [
        makeMessage("assistant", "x".repeat(PER_TASK_OUTPUT_CAP + 100)),
      ],
      stderr: "",
      reportPath: "/runs/report.md",
    } as SingleResult;
    const output = getResultOutput(result);
    expect(output).toContain(
      "bytes omitted. Full output preserved in tool details.",
    );
    expect(output.indexOf("Persisted report: /runs/report.md")).toBeLessThan(
      output.indexOf("PARTIAL/UNVERIFIED"),
    );
  });

  it("does not claim a report was persisted when diagnostics failed", () => {
    const result = {
      exitCode: EXIT_CODE.FAILED,
      messages: [],
      stderr: "stderr text",
      reportPath: "/runs/report.md",
      diagnosticsError: "disk unavailable",
    } as unknown as SingleResult;
    const output = getResultOutput(result);
    expect(output).toContain("stderr: stderr text");
    expect(output).not.toContain("Persisted report:");
  });
});

describe("truncateParallelOutput", () => {
  it("leaves short output untouched", () => {
    const text = "short";
    expect(truncateParallelOutput(text)).toBe(text);
  });

  it("caps output and reports omitted bytes", () => {
    const long = "x".repeat(PER_TASK_OUTPUT_CAP + 100);
    const result = truncateParallelOutput(long);
    expect(result).toContain("Output truncated:");
    expect(result).toContain("bytes omitted");
    // The truncated body itself respects the cap; the marker is appended on top.
    const marker = "\n\n[Output truncated:";
    const body = result.split(marker)[0]!;
    expect(Buffer.byteLength(body, "utf8")).toBeLessThanOrEqual(
      PER_TASK_OUTPUT_CAP,
    );
  });

  it("produces valid UTF-8 after truncation", () => {
    const long = "🙂".repeat(20_000);
    const result = truncateParallelOutput(long);
    expect(result.includes("\uFFFD")).toBe(false);
  });
});

describe("getDisplayItems", () => {
  it("keeps text and toolCall items", () => {
    const messages: Message[] = [
      makeMessage("assistant", "text"),
      {
        role: "assistant",
        content: [
          { type: "toolCall", name: "read", arguments: {}, callId: "1" },
        ],
      } as unknown as Message,
      makeMessage("user", "ignored"),
    ];
    expect(getDisplayItems(messages)).toEqual([
      { type: "text", text: "text" },
      { type: "toolCall", name: "read", args: {} },
    ]);
  });
});

describe("createTextResult", () => {
  it("creates a text result with details and terminate default", () => {
    const ctx = stubContext();
    const results: SingleResult[] = [];
    const res = createTextResult(ctx, "hello", results);
    expect(res).toEqual({
      content: [{ type: "text", text: "hello" }],
      details: {
        mode: "single",
        agentScope: "user",
        projectAgentsDir: null,
        results,
      },
      terminate: false,
    });
  });

  it("respects terminate=true", () => {
    const ctx = stubContext();
    const res = createTextResult(ctx, "stop", [], true);
    expect(res.terminate).toBe(true);
  });
});
