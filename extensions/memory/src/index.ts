import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadMemoryConfig } from "./config.ts";
import { ensureDirs } from "./storage/files.ts";
import { createSearchBackend } from "./search/index.ts";
import { createSnapshotState } from "./snapshot.ts";
import { buildMemoryTools } from "./tools.ts";
import { registerMemoryHooks } from "./hooks.ts";

export default async function (pi: ExtensionAPI) {
    const config = loadMemoryConfig();
    const paths = await ensureDirs(config.dir);
    const search = await createSearchBackend();
    const snapshot = createSnapshotState(config);

    const tools = buildMemoryTools({ paths, config, snapshot, search });
    for (const tool of tools) {
        pi.registerTool(tool);
    }

    registerMemoryHooks(pi, { paths, config, snapshot, search });
}
