# qsh-test

DSH 手机端（Android + proot）的工作仓库。给接手这个工作区的 agent 看的资料都在这里。

## 📖 按顺序读

| 顺序 | 文件 | 内容 |
|---|---|---|
| 1 | [HANDOFF-2026-11-08.md](HANDOFF-2026-11-08.md) | **最新交接**：上一任错在哪、当前确切状态、下一步该做什么。**先读这个** |
| 2 | [DSH-NIGHT-ERRORS.md](DSH-NIGHT-ERRORS.md) | 2026-11-07 夜间事故完整复盘（注意：§3 的「根因」证据不足，以 HANDOFF 为准） |
| 3 | [RESTORE-web-profile.md](RESTORE-web-profile.md) | 一个已验证可启动的 profile 快照。**归档备份，不是生效配置** |

## ⚠️ 三条铁律

1. **不要手改 `profiles/web/package.json`** —— 用 `dsh plugin` 或 `plugin_manager`。
2. **不要在 web profile 上试新插件** —— 激活失败会让 App 安全模式停用**全部**第三方插件。
3. **界面出问题时先回滚，不要继续猜。** 回退文件在 `/sdcard/dsh/safety/`。

## 当前状态（2026-11-08 11:41）

- DSH `0.2.1-rc.2`，web profile，3080 单实例，配置 193 条，stderr 干净。
- 已启用第三方插件：**仅 `dsh-whale-widget` 0.3.18**。
- 停用 6 个，在 `node_modules/.dsh-disabled/`，**未经确认不要恢复**。
