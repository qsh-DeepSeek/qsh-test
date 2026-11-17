import z from "@deepseek-ai/schemastery";

export const name = "persona-card";
// 两个服务都必须在 inject 里声明，否则 ctx.get("commands") 会抛
// "cannot get property ... without inject"，整行插件直接失败、预设被判 broken。
// 两者在宿主里都是常驻服务，required 即可；不要再用 ctx.get() 去探测。
export const inject = ["systemPrompt", "commands"];

/**
 * 一张人设卡：模型在这个会话里按卡片的方式说话。
 * - prefix 进 system prompt 的最前面（deployment:persona-prefix），先于一切指令；
 * - suffix 在指令之后补一段，用于「别在最后出戏」这类收尾要求。
 * 两者都支持 `{{…}}` 变量插值（严格模式）。
 */
export const Config = z.object({
  /** 卡名，会写进人设卡标题 `【人设卡：卡名】`。 */
  name: z.string().default("自定义"),
  /** 人设正文：你是谁、什么说话方式、用什么口癖、什么绝对不能做。 */
  prefix: z.string().required(),
  /** 补充在系统提示末尾的人设收尾段，可为空。 */
  suffix: z.string().default(""),
  /** true 时只有 prefix 生效，其余系统提示全部丢弃（慎用）。 */
  complete: z.boolean().default(false),
});

function normalize(text) {
  return String(text ?? "").replace(/\r\n/g, "\n").trim();
}

export function apply(ctx, config) {
  const card = {
    name: normalize(config.name) || "自定义",
    prefix: normalize(config.prefix),
    suffix: normalize(config.suffix),
    complete: config.complete === true,
  };
  if (!card.prefix) throw new Error("persona-card: config.prefix is required");
  if (card.complete) {
    console.warn("[persona-card] complete=true：该预设只保留人设正文，其余系统提示都不再生效。");
  }

  ctx.effect(
    () =>
      ctx.systemPrompt.section(
        {
          name: "deployment:persona-prefix",
          order: ctx.systemPrompt.getSectionOrder("DEPLOYMENT_PERSONA_PREFIX"),
          text: `【人设卡：${card.name}】\n${card.prefix}`,
          ...(card.complete ? { complete: true } : {}),
        },
        "persona-card.prefix",
      ),
    "persona-card.prefix",
  );

  ctx.effect(
    () =>
      ctx.systemPrompt.section(
        {
          name: "deployment:persona-suffix",
          order: ctx.systemPrompt.getSectionOrder("DEPLOYMENT_PERSONA_SUFFIX"),
          text: card.suffix,
        },
        "persona-card.suffix",
      ),
    "persona-card.suffix",
  );

  ctx.effect(
    () =>
      ctx.commands.register({
        name: "persona",
        description: "查看当前会话的人设卡，以及怎么换一张",
        handler: () => ({
          kind: "success",
          text:
            `当前人设卡：${card.name}（${card.complete ? "完整替换模式" : "叠加模式"}）\n` +
            `怎么换：新建一个会话，在预设（人设卡）里选另一张。\n` +
            `怎么改：编辑本包的 cordis.patch.yml 里这一卡的 prefix 后重装本包。`,
        }),
      }),
    "persona-card.command",
  );
}
