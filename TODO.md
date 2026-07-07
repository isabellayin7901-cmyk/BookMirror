# TODO

> 一次只做一项，做完打勾 + 提交 git。每项写清：目标 / 允许改动范围 / 不许破坏 / 验收。
> 详规见 `docs/PRD.md` `docs/DESIGN.md` `docs/ARCHITECTURE.md`。

## 进行中 / 待办
- [ ] **重启资治通鉴 OCR**：8332 页扫描版，`ocr_pdf.py --split 12`，需机器不休眠(caffeinate)、约 3.5h。上次后台任务中途死掉、0 册入库。
- [ ] **加书：何以为父 / 从你的全世界路过**：等用户发 PDF 或 EPUB。EPUB 走 `epub_ingest.py`，PDF 走 `ingest_pdf.py`(文字)或 `ocr_pdf.py`(扫描)。
- [ ] **推送安卓自测**：装新包 + 开通知权限 → 注册 FCM token → `/api/push/test?handle=xxx` 验证送达。前提：Render 已配 `FCM_SERVICE_ACCOUNT_JSON`。
- [ ] **白屏根因复盘**：本轮靠 4s 启动兜底 + clipboard 懒加载修好，但没拿到设备日志确认真因；下次能抓 adb logcat 时补确认。

## 想做 / 未排期
- [ ] 群聊（他人主页「ta 的群聊」目前是占位）
- [ ] 收藏的句子查看页（小镜子里收藏的句子现在只存不看）
- [ ] iOS 推送（需付费 Apple 账号）
- [ ] SQLite → MySQL（并发/稳定性；`DATABASE_URL` 切换）
- [ ] 阅读器翻页手感实测调优（用户最看重流畅度）
- [ ] 扩公版书（Gutenberg 支持批量，给方向就加）

## 已完成（大块，倒序）
- [x] 内测书库 + WebView 阅读器（翻页 / 字体背景边距 / 进度锚点 / 段落评论笔记）
- [x] AI 凭印象找书（检索全库 + Claude 认书）
- [x] 公版书导入 26 本（Gutenberg，繁→简）；PDF / OCR / EPUB 导入脚本
- [x] 收藏跟账号走（修复重登丢失）
- [x] 推送直连 FCM v1 + 消息时间戳分组 + 聊天发图片
- [x] 社交：ID / 找好友 / 关注体系 / 备注 / 隐私 / 私信(已读回执/图片) / 来信横幅
- [x] 小镜子长按治愈风菜单（复制 / 引用 / 删除 / 转发 / 收藏 / 多选）
- [x] 个人主页 + 三合一评价与成长体系 + 星格(MBTI×星座) + 账号跨设备同步
- [x] 手机号 / Google 登录
- [x] 141 本中文书库 + AI 推断 MBTI + 推荐(SQL 筛选→Claude 排序→防幻觉)
- [x] 小镜子(雪宝) AI 陪伴 + 多对话 + 画像记忆 + 语气卡
- [x] 前端 4 页面 + 中英双语 i18n + 反馈系统
