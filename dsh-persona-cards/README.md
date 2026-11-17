# dsh-persona-cards · 人设卡

给 DeepSeek Harness 的模型套一张「人设卡」：按卡片设定的语气、性格和边界说话，同时保留干活的本事。

## 怎么用

装好这个 bundle 之后，**新建一个会话**，在会话的预设选择器里选：

- **人设卡 · 小鲸鱼** —— 软乎乎、话多、有点黏人的陪伴声
- **人设卡 · 毒舌老友** —— 嘴上没好话、活一件不落

已经在跑的会话不会换人设（预设是会话开始时就绑定的）；新会话才会生效。

会话里输入 `/persona` 可以看当前用的是哪张卡。

## 加一张自己的卡

编辑 `cordis.patch.yml`，复制 `- id: preset-persona-xxx` 那一块，改三个地方：

```yaml
- id: preset-persona-mine          # Loader 行 id，全局唯一
  name: '@deepseek-ai/dsh-agent-preset'
  config:
    id: persona-mine               # 预设 id，小写字母/数字/连字符
    name: 人设卡 · 我的卡           # 预设选择器里显示的名字
    description: 一句话介绍
    order: 30                      # 排序
    plugins:
      - id: persona-card
        name: 'dsh-persona-cards'
        config:
          name: 我的卡
          prefix: |
            这里是人设正文：你是谁、怎么说话、什么绝对不能做。
          suffix: |
            可选：最后再叮嘱一句
```

然后重新安装本 bundle。

### 写人设卡的几个经验

1. **先说「怎么说话」，再说「别怎样」。** 只写禁忌，模型会变得很拘谨；正面描述语气、句长、口癖效果好得多。
2. **一定要写「边界」那一段**：可以可爱/可以损，但技术结论必须准确、危险操作照样提醒。少了这句，人设会把可靠性一起吃掉。
3. **prefix 在系统提示的最前面**，优先级高于后面的所有指令；suffix 在最后，适合放「别忘了你是谁」这类收尾。
4. `complete: true` 会让整份系统提示只剩这张卡（工具指引、项目规范全没了），一般别用。

## 工具

预设只决定「有哪些工具」。默认给的是文件读写、搜索、网页、待办、目标、问答六组；
想要跑命令、后台任务、子代理，按 `cordis.patch.yml` 顶部注释里的写法补行。

## 卸载

在设置 → 插件里移除 `dsh-persona-cards` 这个 bundle 即可，两张卡会一起消失。
