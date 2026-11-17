#!/usr/bin/env node
/**
 * 生成一张新卡的 YAML 片段，贴进 cordis.patch.yml 即可。
 *
 * 手抄卡片最容易漏两件事：工具行的必填 config（漏了预设直接 broken），
 * 以及 Loader 行 id / config.id 的命名约定。这个脚本把这两点固化下来。
 *
 * 用法：
 *   node scripts/new-card.mjs --id acai --name "人设卡 · 阿彩" --desc "说明" \
 *     --prefix-file my-prefix.txt [--suffix-file my-suffix.txt] [--order 23] [--no-goal]
 *
 * 不给 --prefix-file 时从 stdin 读人设正文（Ctrl-D 结束）。
 * 只输出到 stdout，不直接改 cordis.patch.yml —— 先看一眼再贴。
 */
import { readFileSync } from "node:fs";

// 每张卡共用的一套工具行。必填 config 已内置，别删。
const TOOL_ROWS = [
  `          - id: tool-fs
            name: "@deepseek-ai/dsh-tool-fs"`,
  `          - id: tool-fs-search
            name: "@deepseek-ai/dsh-tool-fs-search"
            config:
              sampleOverCapGlobResults: true
              globMaxResults: 200
              grepMaxMatches: 200`,
  `          - id: tool-web
            name: "@deepseek-ai/dsh-tool-web"`,
  `          - id: tool-todo
            name: "@deepseek-ai/dsh-tool-todo"
            config:
              allowParallelInProgress: false`,
  `          - id: tool-ask-user
            name: "@deepseek-ai/dsh-tool-ask-user"`,
];
const GOAL_ROW = `          - id: tool-goal
            name: "@deepseek-ai/dsh-tool-goal"`;

function usage(code = 1) {
  const msg = `用法: node scripts/new-card.mjs --id <小写字母/数字/连字符> --name "<显示名>" --desc "<一句话>" [--prefix-file f] [--suffix-file f] [--order N] [--no-goal]`;
  if (code === 0) console.log(msg); else console.error(msg);
  process.exit(code);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-goal") { out.noGoal = true; continue; }
    if (a === "--help" || a === "-h") usage(0);
    if (!a.startsWith("--")) usage();
    const key = a.slice(2);
    const val = argv[++i];
    if (val === undefined) usage();
    out[key] = val;
  }
  return out;
}

// YAML 块标量内容缩进：卡片里 prefix 位于 "prefix: |" 之下，内容需再缩进 2 段
function indentBlock(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => (line.length ? "                " + line : ""))
    .join("\n");
}

const args = parseArgs(process.argv.slice(2));
if (!args.id || !args.name || !args.desc) usage();
// agent-preset 的 id 约束：小写字母、数字、连字符
if (!/^[a-z0-9-]+$/.test(args.id)) {
  console.error(`错误: --id 只能用 小写字母/数字/连字符，收到 "${args.id}"`);
  process.exit(1);
}
if (args.id.startsWith("persona-")) {
  console.error("错误: --id 不要带 persona- 前缀，脚本会自己加（传 acai，不是 persona-acai）");
  process.exit(1);
}

const presetId = `persona-${args.id}`;
const rowId = `preset-persona-${args.id}`;
const order = args.order ?? "23";

let prefix;
if (args["prefix-file"]) {
  prefix = readFileSync(args["prefix-file"], "utf8").trim();
} else {
  prefix = readFileSync(0, "utf8").trim();
}
if (!prefix) {
  console.error("错误: 人设正文是空的（--prefix-file 或 stdin）");
  process.exit(1);
}

const suffix = args["suffix-file"] ? readFileSync(args["suffix-file"], "utf8").trim() : "";
const tools = args.noGoal
  ? TOOL_ROWS
  : [...TOOL_ROWS.slice(0, 4), GOAL_ROW, TOOL_ROWS[4]];

const cardName = args.name.replace(/^人设卡\s*·\s*/, "");

const lines = [];
lines.push("");
lines.push("    # ------------------------------------------------------------------");
lines.push(`    # 卡：${args.name}`);
lines.push("    # ------------------------------------------------------------------");
lines.push(`    - id: ${rowId}`);
lines.push(`      name: "@deepseek-ai/dsh-agent-preset"`);
lines.push("      config:");
lines.push(`        id: ${presetId}`);
lines.push(`        name: ${JSON.stringify(args.name)}`);
lines.push(`        description: ${JSON.stringify(args.desc)}`);
lines.push(`        order: ${order}`);
lines.push("        plugins:");
lines.push("          - id: persona-card");
lines.push(`            name: "@local/dsh-persona-cards"`);
lines.push("            config:");
lines.push(`              name: ${JSON.stringify(cardName)}`);
lines.push("              prefix: |");
lines.push(indentBlock(prefix));
if (suffix) {
  lines.push("              suffix: |");
  lines.push(indentBlock(suffix));
}
lines.push("              includeRuntimeContext: true");
for (const row of tools) lines.push(row);
lines.push("");

process.stdout.write(lines.join("\n"));
