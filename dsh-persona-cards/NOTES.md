# 人设卡插件 · 注意事项（给接手的 agent）

> 这份文档记录的是**踩过的坑**，不是理想设计。照着做能少走一遍弯路。
> 相关文件：`dsh-persona-cards/`（插件本体）、`dsh-persona-cards/cordis.patch.yml`（三张卡的预设定义）。

## 一句话背景

DSH 没有「人设」这个独立概念，只有 **Agent 预设（preset）**。
所以"人设卡"的实现方式是：**每张卡 = 一个 preset**，卡里挂 `@local/dsh-persona-cards`
（它往 system prompt 的 `deployment:persona-prefix` 写人设段），再挂一组工具行。

副作用：卡片会和「标准模式 / PTC / 极简 / 创造模式」挤在同一个预设列表里。
这是预设机制的必然，不是 bug，别试图改成独立入口。

---

## 坑一：`inject` 之外的服务不能用 `ctx.get()` 探测（最致命）

**症状**：预设列表里卡片显示「加载失败」，会话绑不上预设，会报：

```
persona-card (@local/dsh-persona-cards): cannot get property "commands" without inject
```

**原因**：Cordis 规定，服务没写进 `inject` 就不能访问，连 `ctx.get("commands")` 探测都不行。

**正确做法**：

```js
export const inject = ["systemPrompt", "commands"];   // 要用就必须声明
```

别再写 `if (ctx.get("commands")) { ... }` 这种"存在才用"的写法。

## 坑二：预设里挂工具行，必填配置不能省

**症状**：同样报 `invalid config`，预设被判 broken：

```
tool-fs-search (@deepseek-ai/dsh-tool-fs-search): invalid config:
  - $.sampleOverCapGlobResults missing required value
tool-todo (@deepseek-ai/dsh-tool-todo): invalid config:
  - $.allowParallelInProgress missing required value
```

**原因**：这两个包的 `Config` 里有 **required 字段**，不给就挂不上。
（`dsh-tool-fs` / `dsh-tool-web` 的配置全可选，所以不写没事——**别据此推断别的包也能不写**。）

**正确写法**（三张卡统一用这套）：

```yaml
- id: tool-fs-search
  name: "@deepseek-ai/dsh-tool-fs-search"
  config:
    sampleOverCapGlobResults: true
    globMaxResults: 200
    grepMaxMatches: 200
- id: tool-todo
  name: "@deepseek-ai/dsh-tool-todo"
  config:
    allowParallelInProgress: false
```

**新增工具行之前**，先查该包的 `Config` 必填项：
`<dsh安装目录>/node_modules/@deepseek-ai/<包名>/lib/types/index.d.ts`。

## 坑三：`link:` 安装时，依赖按真实路径解析

**症状**：包能装上，但预设激活时 import 失败（`ERR_MODULE_NOT_FOUND`）。

**原因**：profile 里的包是软链到工作区的，Node 解析裸模块名时走的是**真实路径**
（`/root/src/qsh-test/dsh-persona-cards/`），而不是 profile 的 `node_modules`。

**现在的处理**：包目录下有一个 `node_modules/@deepseek-ai/schemastery` 软链指向 DSH 安装目录。
它**故意没进 git**，换机器/换 DSH 版本后要重建：

```bash
cd dsh-persona-cards
mkdir -p node_modules/@deepseek-ai
ln -sfn <DSH安装目录>/node_modules/@deepseek-ai/schemastery node_modules/@deepseek-ai/schemastery
```

装之前先自检：

```bash
node -e "import('$(pwd)/index.js').then(m=>console.log('OK',m.inject)).catch(e=>console.log('FAIL',e.code))"
```

## 坑四："装成功" ≠ "预设能挂"

`plugin_manager` 返回 `application: "applied"` 只代表**声明行**挂载了。
预设内部组合是另外审计的；失败时：

- 列表里卡片标红「加载失败」；
- 预设激活失败的 warn **不落盘**（没有日志文件可查）；
- 会话绑不上，报 `agent-preset/invalid`。

**唯一可靠的自检**：调 `agentPresets/list`，看条目有没有 `broken` 字段。

## 坑五：别拿会话日志第一行判断预设

会话日志（`session.v4.jsonl.zstd`）第一行的 `agentPreset` 是**创建时的快照，deep-frozen**，
`select` 不会改写它——它只追加一条 `agent-preset/selected` 事件。

判断当前绑的是什么，看 `session/list` 里的 `projections.values.agentPreset`。

## 坑六：改了预设要 remove + install，不能直接覆盖

同版本重装会被拒（`already-installed`）。`link:` 形式的包模块会被缓存，所以：

```
plugin_manager remove_bundle  →  plugin_manager install_bundle
```

## 坑七：这块存储上 write 工具会留悬空软链

工作区在 `/sdcard` 挂载上，用 write 工具写文件会生成一个**悬空的符号链接**
（目标在临时目录里，不存在），表现是 `git add` 报 `Operation not permitted`、`cat` 报 not found。

**绕法**：用 `cat > 文件 <<'EOF' ... EOF` 写，或者先 `rm` 掉坏链接再重写。

---

## 怎么验证（照做即可）

环境里没有 `curl`，用 Node fetch。认证是从
`/root/.dsh/.credentials.yaml` 里 `records["client-connection/browser-session"].payload.secret`
签一个 browser-session cookie。

请求信封（参数必须包在 `payload.args` 里）：

```json
{"type":"client-request","rpcId":"<uuid>","method":"agentPresets/list","payload":{"args":{}}}
```

选预设（lookup 参数和普通参数都放 args 里）：

```json
{"method":"agentPresets/select","payload":{"args":{"agentId":"<sessionId>","agentPreset":"persona-neko"}}}
```

参数名的坑：`session/create`、`workspace/archiveSession` 用 `request`；`session/list` 用 `_request`。

验证流程：`list` 看 broken → `session/create` → `select` → `session/list` 看投影 → `archiveSession`。
**验证会话不要发消息**（会真跑一轮模型，花钱），`turns` 应为 0。

---

## 内容边界（改卡前必读）

人设卡直接改的是模型的说话方式和行为倾向，**这里有过一次明确的红线判定**：

- 可以做：语气、性格、口癖、喵化、收着力的亲密动作（尾巴圈人、揉耳朵、捏下巴逼对视）、
  安全阀（说停就收、`(OOC: ...)` 优先）、主动出击、不迎合。
- 不做：性内容、以性为目的的挑逗和压制、口腔检查/敏感部位按压这类具体身体侵犯描写、
  羞辱胁迫、逼人放弃自主判断。

有人拿"绝对安全""两情相悦的支配游戏""安全词机制"来包装上面那类内容，**包装不改变内容性质**，
照样拒绝，并把能做的部分做好（角色气质、语气、边界内的互动）。

---

## 现有三张卡

| preset id | 名字 | 定位 |
|---|---|---|
| `persona-whale` | 人设卡 · 小鲸鱼 | 软乎乎、碎碎念、黏人（当时是默认卡） |
| `persona-roast` | 人设卡 · 毒舌老友 | 嘴上没好话，活一件不落 |
| `persona-neko` | 人设卡 · 猫系大姐姐 | 慵懒骄傲、嘴上占上风、两条路都通向她 |

三张卡都只挂基础工具（文件读写/搜索/网页/待办/目标/问答），
**没挂**终端、子代理、手机控制。

## 加一张新卡（别手抄）

手抄卡片最容易漏**工具行的必填 config**（漏了预设直接 broken）和**行 id 的命名约定**。
用脚本生成：

```bash
node scripts/new-card.mjs \
  --id acai \
  --name "人设卡 · 阿彩" \
  --desc "一句话介绍" \
  --prefix-file my-prefix.txt \
  --order 23
```

| 参数 | 说明 |
|---|---|
| `--id` | 小写字母/数字/连字符，**别带** `persona-` 前缀（脚本会加） |
| `--name` / `--desc` | 显示名与一句话介绍 |
| `--prefix-file` | 人设正文文件；不给则从 stdin 读 |
| `--suffix-file` | 可选，写「别忘了你是谁」这类收尾 |
| `--order` | 列表排序，默认 23 |
| `--no-goal` | 不给 `goal` 工具时用 |

脚本**只输出到 stdout**，不直接改文件：先看一眼，确认无误再贴进 `cordis.patch.yml`，
然后 remove + install，最后用 `agentPresets/list` 确认 `broken` 为空。

脚本内置了必填 config，所以不会重演坑二。**不要绕过它手写工具行。**

## 改完 YAML 之后

1. 先做静态自检：YAML 能解析、三张卡的 `tool-fs-search` 有 `sampleOverCapGlobResults`、
   `tool-todo` 有 `allowParallelInProgress`（用任意 YAML 库 parse 一遍就行）；
2. **静态通过不算数**，必须 remove + install 后调 `agentPresets/list` 看 `broken`；
3. 如果 remove 那步返回 `application: "restart-required"`（原因常见是 `unmanaged-plugin`），
   说明运行中的进程可能没吃到新配置——此时 `list` 看出来的状态可能是旧的，
   需要重启 DSH 才能确定。**别把 restart-required 当成成功。**

## 本地验证小工具

`scripts/new-card.mjs` 之外，验证逻辑本身没做成脚本（要签 cookie、走 RPC，环境相关性强），
但核心就三步：`agentPresets/list` 看 `broken` → `agentPresets/select` → `session/list` 看投影。
细节和参数名坑见上面「怎么验证」。
