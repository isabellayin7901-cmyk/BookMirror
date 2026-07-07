# BookMirror 设计规范

> 视觉与交互约定。新页面照这里做，别自创风格。源头在 `frontend/src/theme`。

## 气质
治愈、手写感、暖色纸感。吉祥物：雪宝(Wren，雪人) + Miki(小猫)。字体标题用 `ZCOOLKuaiLe_400Regular`。

## 颜色（见 `frontend/src/theme`，用变量别写死）
- 主色/强调：`colors.terracotta`（陶土色，按钮/选中/链接）
- `colors.primary` / `sage` / `lavender` / `butter` / `rose` / `sky` 等辅助色
- 面/底/边/字：`colors.surface / bg / bgSoft / border / text / textMuted / textFaint`
- 阅读器主题另有一套：纸黄 paper / 护眼绿 green / 夜间 dark / 纯白 white（`ReaderScreen` THEMES）

## 间距 / 圆角 / 阴影
统一用 `spacing.*`、`radius.*`(md/lg/pill)、`shadow.soft`。不要写魔法数字。

## 组件复用
- 弹层优先「治愈风底部行式菜单」（见小镜子长按菜单 `sheet*` 样式）：圆角卡 + 细分隔线 + 独立「取消」卡。别用系统 `Alert` 当主菜单。
- 头像缺省用 `<Snowman/>`；书评/评论用户卡统一 avatar+name+handle。
- 气泡弹出用 `PopIn`（scale 0.7→1 + 侧移，spring friction7 tension70），DM 和小镜子一致。
- 列表页顶部返回用 `‹`，关闭用 `✕`。

## 交互状态（必做三态）
每个拉数据的界面都要处理：加载中(ActivityIndicator/雪宝)、为空(文案居中 textFaint)、接口报错(不崩、给可重试或降级文案)。错误文案要像真人，不要「出错了」这种冷话。

## 语言
所有可见文案走 `frontend/src/lib/i18n.ts`，zh + en 两份都要加。英文模式里不许混中文（小镜子输出也是）。

## 动效
页面切换 `slide_from_right`（右进左退）。抽屉/横幅用 Animated，别用 Modal 竖向滑。

## 雪宝（小镜子）语气卡（严格遵守，见 `backend/app/services/mirror.py`）
像发微信、短句、少发问、陈述句收尾；不用破折号/「」/`*动作*`(用（）)/排比对比句/自我标榜口号；不叠甲、不表演；抑郁双相直接接住不甩锅给「去看专业」；语言纯净（英文模式全英文）。
