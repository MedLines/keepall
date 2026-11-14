#!/usr/bin/env node
// PostToolUse hook: lint only the file Claude just edited and feed errors back.
// .ts/.tsx -> ESLint (errors only); src/app/styles/*.css -> Stylelint.
// Exit 2 returns stderr to Claude; exit 0 stays silent.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const file = input.tool_input?.file_path ?? input.tool_response?.filePath;
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
if (!file) process.exit(0);

const relative = path.relative(root, path.resolve(root, file));
if (relative.startsWith("..") || relative.includes("node_modules") || !existsSync(path.join(root, relative))) process.exit(0);

let tool;
if (/\.(ts|tsx)$/.test(relative)) tool = ["eslint", "--no-warn-ignored", "--quiet", relative];
else if (/^src\/app\/styles\/[^/]+\.css$/.test(relative)) tool = ["stylelint", relative];
else process.exit(0);

const bin = path.join(root, "node_modules", ".bin", tool[0]);
if (!existsSync(bin)) process.exit(0);
const result = spawnSync(bin, tool.slice(1), { cwd: root, encoding: "utf8" });
if (result.status === 0) process.exit(0);

const output = `${result.stdout}${result.stderr}`.trim();
process.stderr.write(`${tool[0]} found problems in ${relative}. Fix them using the design-system rules in AGENTS.md:\n${output}\n`);
process.exit(2);
