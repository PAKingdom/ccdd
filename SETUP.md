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

## Bark 通知配置（iOS）

1. iPhone 安装 Bark App，打开首页复制「设备 key」（如 `https://api.day.app/AbCd1234.../` 里的 `AbCd1234...`）
2. 填入 `.env`：

```bash
BARK_KEY=你的设备key
BARK_SERVER=https://api.day.app
```

`BARK_SERVER` 默认官方服务器，自建 Bark 服务器时才需要改。测试：`node notify-system.js --task "测试"`。

## 声音提醒

默认开启，仅支持 Windows。不需要的话设 `SOUND_ENABLED=false`。

想换音效：在 `.env` 里设 `SOUND_FILE`，留空则用默认 Windows 通知音。**支持 `.wav` 和 `.mp3`**（`.wav` 走 SoundPlayer，`.mp3`/`.m4a`/`.wma` 走 MediaPlayer）。系统自带音效在 `C:\Windows\Media\`，例如：

```bash
SOUND_FILE=C:\Windows\Media\tada.wav      # 欢快的“ta-da”
SOUND_FILE=C:\Windows\Media\chimes.wav    # 清脆风铃
SOUND_FILE=C:\Users\你\Music\alert.mp3    # 你自己的 mp3
```

也可以填任意 wav/mp3 文件路径（建议短音效，1~3 秒）。（原来的机器人语音已换成音效播放。）

## 故障排除

- 飞书收不到：检查 webhook 地址是否完整复制了
- 手环不震：确认飞书通知权限开着，手环和手机蓝牙连着
- 声音不响：Windows only，检查 PowerShell 能否正常运行
