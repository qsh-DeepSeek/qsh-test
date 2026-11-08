# DSH 手机端 2026-11-07 夜间故障完整记录

> 给下一个 agent 的交接文档。
> 时间：2026-11-07 19:00 - 2026-11-08 07:00（约 12 小时）
> 环境：Android 16 / vivo V2238A / DSH 0.2.1-rc.2 / proot Ubuntu 24.04

---

## 0. 一句话结论

**这台机器上 DSH 从启动到监听端口需要 68-77 秒，而 App 只等 43 秒就判超时。**
这是当前界面打不开的根本原因，与插件、配置无关。

---

## 1. 需要立即知道的 6 条铁律

### 01 不要在主 profile 上试插件

`~/.dsh/profiles/web` 是用户日常使用的 profile。一旦启动失败，App 的「插件安全模式」会：

1. 把 `node_modules/<插件>` 移进 `node_modules/.dsh-disabled/`
2. 把 `package.json` 回滚成 366 字节的最小版本
3. 重启，然后弹窗

这个过程不可逆地反复发生，用户每次重启都要面对一次崩溃界面。
要试插件，必须用独立 profile（见第 5 节）。

### 02 cordis.patch.yml 是数组，不是对象

空文件会报：

```
dsh: overlay .../cordis.patch.yml must be a top-level YAML array of loader patch entries
```

最小合法内容是 `[]` 或至少一条 `- id: xxx`。

### 03 插件包必须导出 ./package.json

这是今晚最大的坑，表现为「配置里有、启动不报错、但插件永不出现」。

```json
"exports": {
  ".": "./index.js",
  "./client": "./client.js",
  "./package.json": "./package.json"
}
```

少最后那行，客户端插件被静默跳过。

原因：`dsh-client-modules` 需要 `require.resolve('<pkg>/package.json')` 才能读到 `dsh.client` 声明。
没有导出会抛 `ERR_PACKAGE_PATH_NOT_EXPORTED`，而调用方吞掉错误、静默跳过，没有任何日志。

### 04 判断客户端插件是否加载，别看 rev

我浪费了大量时间在这里。

- 错误做法：读页面里 `/plugins/??...&rev=xxxx` 的 rev，或数那串 URL 里的插件数量。
  这个 rev 是静态资源版本号，且那串 URL 根本不含全部插件（只是首个组合的路径）。
- 正确做法：解析页面内嵌的 `window.__DSH_BOOT__` JSON，看 `entries` 数组。

### 05 jsx 的第 3 个参数会被静默丢弃

```js
jsx('div', {id:'x'}, 'hello').props.children  // undefined
```

必须把 children 放在 props 里：`jsx('div', {children:'hello'})`。数组用 `jsxs`。

### 06 proot 的 --link2symlink 会让短暂写入变成悬空链接

写入过程中如果进程被杀，落盘的文件会是一个指向 `.l2s.*.tmpdir` 的悬空 symlink：

```
/tmp/xxx.md -> /tmp/.xxx.md.9577.xxxx.tmpdir/.l2s.xxx.md.tmp0001
```

写重要文件后，务必 `read` 一遍确认内容真的在。

另外：`/sdcard` 是模拟文件系统，不支持硬链接，proot 的 link2symlink 写入会直接 EPERM。
往 `/sdcard` 写文件要用 shell 重定向（`cat > file`），不要用会做 rename/link 的写入方式。

---

## 2. 今晚踩的坑，按时间顺序

### 坑 1：patch: entry "dafy-whale-theme" not found

现象：启动 stderr 报错，界面起不来。

原因：`cordis.patch.yml` 里还留着 `dafy-whale-theme` 的配置块，但该插件已被安全模式停用、包已不在 `node_modules`。

修复：删掉那段配置。

教训：安全模式只摘插件，不清理 patch 里的引用，形成死循环：
停用插件 -> patch 引用失效 -> 启动失败 -> 再停用。

### 坑 2：误以为「时钟差 8 小时」是元凶

现象：容器内 `date` 显示 22:47，手机显示 06:47。

真相：容器是 UTC，手机是 UTC+8，完全正常。
`/sdcard` 上文件的时间戳来自宿主，与容器时钟不同源。

教训：别把正常现象当 bug 查。

### 坑 3：误以为「rev 过期 / 时钟错乱」导致前端 pending

浪费了大量时间。`inventory` 是纯内存读取，不碰时钟、不碰 rev。

### 坑 4：Failed to fetch 的真正含义

```
[ui-cordis] reading the Cordis inventory failed:
Error: gateway/internal: client api: dynamicCordisRunner/inventory failed: Failed to fetch
```

`Failed to fetch` 是浏览器原生网络层错误，意思是请求根本没到服务端。
在 `dsh-api-gateway` 里，`gateway/internal` 加这个文案来自 `carrierFailure()`，
专门兜 `offline / transport fault`。

所以它不代表插件有问题，代表连接断了。
那次真正的恢复方式是用户点「重试」—— 一次就好了。

### 坑 5：插件 exports 缺 ./package.json（见铁律 03）

导致 `dsh-superagent-button` 反复「加载失败」。

### 坑 6：link: 安装 vs file: 安装

- `link:../path` -> `node_modules` 里是符号链接
- `file:../path` -> pnpm 打成实体目录

我一开始用 `link:`，一度怀疑是软链接在 proot 下解析失败。
实测：软链接在容器内 `fs.realpathSync` 完全正常，不是问题。

为了稳妥最终改成 `file:` 安装。
注意：改 `package.json` 后要 `rm -f node_modules/<pkg>` 再 `pnpm install`，否则 pnpm 不会替换已存在的链接。

---

## 3. 最终定位：启动耗时 68-77 秒，App 只等 43 秒

### 实测数据

| 场景 | 耗时 |
|---|---|
| 配置合成（--dump-config） | 1.1 秒 |
| Node 自身启动 | 0.16 秒 |
| 加载 dsh 主模块 | 1.0 秒 |
| web profile 冷启动到监听端口 | 68 秒（两次：67.7s / 67.9s） |
| superagent profile（完全不同配置） | 77 秒 |
| 禁用 office-to-pdf（48MB WASM）后 | 68 秒（无改善） |
| 页面 HTML 响应 | 28 ms |
| 主 JS bundle（899KB） | 48 ms |
| 各插件 bundle（70 个） | 4-11 ms 每个，70/70 全部 200 |

### 结论

68-77 秒是这台手机的固有速度，与插件数量、配置内容都无关。
对照实验：换一个完全不同的 profile，同样 77 秒。

而 App 日志里明确写着：

```
TIMING +43233ms  dsh web 就绪（awaitUrl 返回）
```

App 在 43 秒就返回了。它根本没等到服务真正就绪。

### 已验证的健康状态

- 服务端响应 401/200 均在 20-30ms
- 70 个客户端插件 bundle 全部可取
- `--dump-config` 192 条，stderr 0 字节
- profile 只剩 `dsh-phone` + `dsh-phone-files`，无任何第三方插件

服务端和前端都是健康的。问题在 App 的等待超时。

---

## 4. 未解决的问题

如何让 App 等够 68 秒？

候选思路（均未验证）：

1. 升级内核 0.2.1-rc.2 -> 0.2.2-rc.1（App 内「设置 -> 内核升级（本机）」有提示）。
   新版可能优化启动速度或调整 awaitUrl 超时。
2. 减少启动插件。对照实验显示配置不影响总耗时，大概率无效。
3. 在 3080 前置一个快速应答的代理，让 App 立刻认为就绪，实际请求转发给 DSH。
   风险高，会改变 App 启动流程，不要在没有用户明确同意时动手。
4. 查 App 源码里 awaitUrl 超时是否可配。最直接的方向，但 App 是闭源 APK。

---

## 5. 安全的实验方法（务必遵守）

### 独立 profile 测试

```bash
mkdir -p /root/.dsh/profiles/testprof && cd /root/.dsh/profiles/testprof

cat > package.json <<'EOF'
{
  "name": "test-prof",
  "private": true,
  "dependencies": { "your-plugin": "file:/path/to/plugin" },
  "dsh": { "profile": { "bundles": [
    "@deepseek-ai/dsh-base",
    "@deepseek-ai/dsh-web-app",
    "your-plugin"
  ] } }
}
EOF

echo "[]" > cordis.patch.yml

pnpm install

dsh --profile testprof --no-open --port 3555
```

测完立刻 kill，不要留进程。这台手机内存紧（11G 总量，常用 7G+，swap 4.2G）。

### 清理测试进程的正确姿势

不要用 `pkill -f "port 3666"` —— 它会匹配到自己所在的 shell，把命令本身杀掉。用：

```bash
ps -eo pid,args | grep "port 3666" | grep -v grep | awk '{print $1}' | while read p; do kill $p; done
```

### 验证客户端插件是否真的加载

```js
const a = await get('/?token=' + TOK);            // 303 + Set-Cookie
const ck = a.headers['set-cookie'].map(c=>c.split(';')[0]).join('; ');
const b = await get('/', {Cookie: ck});

const start = b.b.indexOf('= {"rev"');
let d=0,i=start+2,beg=i;
for(;i<b.b.length;i++){const c=b.b[i];if(c==='{')d++;else if(c==='}'){d--;if(d===0)break;}}
const boot = JSON.parse(b.b.slice(beg, i+1));
console.log(boot.entries.length);                // 真实插件数
```

基线参考：干净 profile = 70 entries（含 2 个自带插件）。

---

## 6. 关于 App 的「插件安全模式」

这是 App 自己的机制，不是 DSH 的行为（DSH 代码里搜不到 `dsh-disabled` 字符串）。

触发条件：启动失败。
行为：摘插件 -> 回滚 `package.json` -> 重启 -> 弹窗。

弹窗文案里有一句很关键：

> 已经自动停用第三方插件并重启过 N 次，界面仍然起不来 —— 所以问题很可能不在插件上

App 自己都知道。当你看到 N >= 2，就别再怀疑插件了。

弹窗里有一行「这次检测到可疑插件：xxx」——只有 profile 里真有第三方插件时才会出现。

---

## 7. 其他环境事实

| 项 | 值 |
|---|---|
| DSH 版本 | 0.2.1-rc.2（有 0.2.2-rc.1 可升级） |
| 端口 | 3080 = 主服务；3099 = 手机控制桥（token 在 /run/dsh-phone/token）；3082 = superagent |
| token 机制 | /?token= -> 303 + Set-Cookie -> 后续靠 cookie；每次重启换新 token |
| 启动命令 | proot ... dsh --profile web --no-open --port 3080（由 App 拉起，父进程在容器外，杀不掉） |
| 内存 | 11G 总量 / 常用 7G+ / swap 4.2G（紧张） |
| CPU | 8 核，DSH 启动是 CPU 密集型线性爬升（cpu 20-30%，RSS 60MB 到 300MB） |

### 工具可用性

- 有：`node` `pnpm` `npm` `git` `gh` `setsid` `nohup`
- 没有：`python3` `tmux` `curl` `jq` `crontab` `/usr/bin/time`
- 读不到：`/proc/net/tcp`（EACCES）、App 的 stdout（在容器外）

### 网络

- github.com:443 直连超时（clone/push 都会挂）
- 但 `gh api` 可用
- 推文件用 `gh api repos/OWNER/REPO/contents/PATH -X PUT`，别用 git clone

---

## 8. 给下一个 agent 的建议

1. 先确认用户界面是否可用，再谈功能。用户已经被搞崩三次了。
2. 用户要的是「能用」，不是「完美」。任何改动前先问一句。
3. 不要在没验证的情况下宣称找到根因。我今晚错了很多次：
   - 说是插件冲突 -> 错
   - 说是时钟 -> 错
   - 说是 rev 过期 -> 错
   - 说是软链接悬空 -> 错
   - 说是缓存 -> 错（清了缓存照样不行）
   - 最后对照实验才确认是启动耗时 vs 等待超时
4. 每次起测试实例前先数一下有几个 dsh 在跑，别叠加。
5. 别手改 `package.json`，用 `dsh plugin --profile <name> add/remove`。
   手改会导致 pnpm 说 `Already up to date` 但依赖其实没装，然后 reconcile 抛错。

---

## 9. 当前残留状态

- `~/.dsh/profiles/web`：干净，只有 `dsh-phone` + `dsh-phone-files`
- `node_modules/.dsh-disabled/`：7 个被安全模式停用的第三方插件（包都在，可恢复）
- `/root/.dsh/plugins/dsh-superagent-button/`：按钮插件源码（已修好 exports，但未安装）
- `/root/.dsh/plugins/dsh-superagent-src/`：superagent 源码（4.1M，已构建）
- `/sdcard/dsh/SUPERAGENT-进度.md`：更早的进度记录

---

文档生成时间：2026-11-08 07:00
