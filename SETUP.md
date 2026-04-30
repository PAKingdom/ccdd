# 配置指南

## 飞书通知配置

1. 飞书里建个群（只有自己也行），进群设置 → 群机器人 → 添加自定义机器人 → 复制 Webhook 地址
2. 复制 `.env.example` 为 `.env`，把地址填进去：

```bash
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/你的地址
```

3. 测试：`node notify-system.js --task "测试"`

## Telegram 通知配置

1. 找 @BotFather 创建机器人，拿到 Token
2. 给机器人发条消息，访问 `https://api.telegram.org/bot<TOKEN>/getUpdates` 拿到 Chat ID
3. 填入 `.env`：

```bash
TELEGRAM_BOT_TOKEN=你的token
TELEGRAM_CHAT_ID=你的chat_id
```

需要代理的话加一行 `HTTPS_PROXY=http://127.0.0.1:7890`。

## 声音提醒

默认开启，仅支持 Windows。不需要的话设 `SOUND_ENABLED=false`。

## 故障排除

- 飞书收不到：检查 webhook 地址是否完整复制了
- 手环不震：确认飞书通知权限开着，手环和手机蓝牙连着
- 声音不响：Windows only，检查 PowerShell 能否正常运行
