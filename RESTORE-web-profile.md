# ⚠️ 归档备份 · 不要当配置用 ⚠️

> **这是一份快照备份，不是正在生效的配置。**
>
> 本地实际生效的文件：`/root/.dsh/profiles/web/package.json` 与 `cordis.patch.yml`。
> 改这里不会有任何效果；把这里的内容直接往别处拷也要先看清下面的使用说明。

---

## 这份快照是什么

拍于 **2026-11-08 10:53 (北京时间)**，是一个**已验证可以正常启动**的微型 profile。

| 项 | 值 |
|---|---|
| 依赖插件 | 只有 `dsh-phone`、`dsh-phone-files`（应用自带） |
| bundles | 4 个（base、web-app、phone、phone-files） |
| patch 条目 | 7 条，全部面向官方插件 |
| 第三方插件 | **0 个** —— 全部位于 `node_modules/.dsh-disabled/` |
| 校验值 | `package.json` 366 字节 / `cordis.patch.yml` 1180 字节 |

**sha256**（拷回后可用来核对是否一模一样）：

```
f34edfb2bcc2922fc77cd1478c8b7b024c33cb5955326dd52b169a55e3efb411  package.json
0d70fc23f8dac3588306ea81446b9a0fe7da10ce40063523c53856bd8378d531  cordis.patch.yml
```

### 为什么要存这份

2026-11-07 夜间，一个第三方按钮插件激活失败，App 的「插件安全模式」连锁停用了全部第三方插件，
接着一夜都在排查一个已经不成立的结论（见 `DSH-NIGHT-ERRORS.md` 与仓库里的同名文件）。
那次最后发现：不是没了救，而是**没有一份干净、可以无脑回归的配置**又被反复改乱。

## 怎么用

1. 先把下面两个文件各自**原样**拷回 `/root/.dsh/profiles/web/`。
   注意：那两个实际文件名就是 `package.json` 和 `cordis.patch.yml`，不要带上本文件的名字。
2. 再重启 App。
3. 重启后界面仍然起不来，就点弹窗上的「重试」。

`package.json` 旁边有一个关键详情：它**应该含 `\/` 转义**（`file:.\/dsh-phone-1.0.2.tgz`）。
这不是字面问题：实测中，带 `\/` 就是「安装器写入」的特征，不带就是「手写」的。
请整段原样复制，一个字符都别改 —— 特别是空格和 `\/`，不要自己重新排版。

### 不要做的事

- 不要把本文件直接当成 `package.json` 使用。这是一份文档，不是可执行的 JSON。
- 不要把 `package.json` 与 `cordis.patch.yml` 两个文件的内容合并到一起。它们是两个独立文件。
- 不要重建 `node_modules`。本快照不包含 `node_modules`，也不需要它。

### 与仓库内容的关系

文件名一律带 `dsh-profile-web.` 前缀，**就是为了防止它们被当成就地生效的配置**。

---

## `dsh-profile-web.package.json`  →  应为 `package.json`

```
{
  "name": "dsh-profile-web",
  "private": true,
  "dependencies": {
    "dsh-phone": "file:.\/dsh-phone-1.0.2.tgz",
    "dsh-phone-files": "file:.\/dsh-phone-files-1.0.2.tgz"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai\/dsh-base",
        "@deepseek-ai\/dsh-web-app",
        "dsh-phone",
        "dsh-phone-files"
      ]
    }
  }
}
```

## `dsh-profile-web.cordis.patch.yml`  →  应为 `cordis.patch.yml`

```
# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; `!!js` expressions allowed).
- id: ui-settings-general
  name: "@deepseek-ai/dsh-client-ui-settings-general"
  config:
    welcomeNoticeVersion: 2026-09-28.1
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config:
    provider: deepseek-official
    model: deepseek-flash
    reasoningEffort: off
- id: web-search-deepseek
  name: "@deepseek-ai/dsh-web-search-deepseek"
  config:
    apiKeyEnv: DEEPSEEK_API_KEY
    maxUses: 3
- id: ui-theme
  name: "@deepseek-ai/dsh-client-ui-theme"
  config:
    preference: dark
- id: ui-chat
  name: "@deepseek-ai/dsh-client-ui-chat"
  config:
    performanceUsage: detailed
- id: subagent-model-selection-settings
  name: "@deepseek-ai/dsh-tool-subagent/model-selection-settings"
  config:
    enabled: true
    allowedModels:
      - provider: deepseek-official
        model: deepseek-flash
- id: agent-preset-registry
  name: "@deepseek-ai/dsh-agent-preset-registry"
  config:
    default: standard
    selectedDefault: cordis
```
