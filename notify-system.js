/**
 * Claude Code 任务完成通知系统
 * 集成声音提醒和飞书推送，支持手环震动
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { envConfig } = require('./env-config');
const { NotificationManager } = require('./notification-manager');

/**
 * 通知系统管理器
 */
class NotificationSystem {
    constructor(options = {}) {
        this.options = options || {};
        this.config = this.loadConfig();
        this.projectName = this.getProjectName();
        this.notificationManager = new NotificationManager(this.config, this.projectName);
    }

    /**
     * 从环境变量加载配置
     */
    loadConfig() {
        const envVars = envConfig.getAllConfig();
        const sound = { ...envVars.sound };
        // 命令行 --sound 覆盖 .env 的 SOUND_FILE（可给不同 hook 配不同音效）
        if (typeof this.options.sound === 'string' && this.options.sound) {
            sound.file = this.options.sound;
        }
        return {
            notification: {
                type: envVars.feishu.enabled ? 'feishu' : 'sound',
                feishu: envVars.feishu,
                telegram: envVars.telegram,
                bark: envVars.bark,
                sound: sound
            }
        };
    }

    /**
     * 获取项目名称
     * 优先级: package.json > git仓库名 > 目录名
     */
    getProjectName() {
        try {
            // 1. 尝试从当前工作目录的 package.json 获取项目名称
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                if (packageData.name) {
                    console.log(`📦 从 package.json 检测到项目名称: ${packageData.name}`);
                    return packageData.name;
                }
            }

            // 2. 尝试从 git 仓库名获取
            const { execSync } = require('child_process');
            try {
                const gitRemote = execSync('git remote get-url origin', {
                    encoding: 'utf8',
                    stdio: 'pipe'
                }).trim();
                // 从 git URL 提取仓库名
                const matches = gitRemote.match(/\/([^\/]+)\.git$/);
                if (matches && matches[1]) {
                    console.log(`🔧 从 git 仓库检测到项目名称: ${matches[1]}`);
                    return matches[1];
                }
            } catch (gitError) {
                // git 命令失败，继续下一步
            }

            // 3. 从当前目录名获取
            const dirName = path.basename(process.cwd());
            console.log(`📁 从目录名检测到项目名称: ${dirName}`);
            return dirName;

        } catch (error) {
            console.log('⚠️  无法获取项目名称，使用默认值');
            return '未知项目';
        }
    }

    /**
     * 播放Windows系统声音
     */
    playWindowsSound() {
        // SOUND_FILE 未配置时用默认 Windows 通知音
        const defaultSound = 'C:\\Windows\\Media\\Windows Notify System Generic.wav';
        const soundFile = this.config.notification.sound.file || defaultSound;
        const safePath = soundFile.replace(/'/g, "''"); // 转义 PowerShell 单引号

        let psScript;
        if (/\.wav$/i.test(soundFile)) {
            // .wav：SoundPlayer 同步播放，快且稳
            psScript = `try { (New-Object Media.SoundPlayer '${safePath}').PlaySync() } catch { [console]::Beep(800, 300) }`;
        } else {
            // .mp3/.m4a/.wma 等：用 MediaPlayer 播放（等到时长可读后播完再退出）
            psScript = `try {` +
                ` Add-Type -AssemblyName PresentationCore;` +
                ` $p = New-Object System.Windows.Media.MediaPlayer;` +
                ` $p.Open([uri]::new('${safePath}'));` +
                ` $t = 0; while (-not $p.NaturalDuration.HasTimeSpan -and $t -lt 50) { Start-Sleep -Milliseconds 100; $t++ };` +
                ` $p.Play();` +
                ` if ($p.NaturalDuration.HasTimeSpan) { Start-Sleep -Milliseconds ([int]$p.NaturalDuration.TimeSpan.TotalMilliseconds + 300) } else { Start-Sleep -Seconds 3 };` +
                ` $p.Close()` +
                ` } catch { [console]::Beep(800, 300) }`;
        }

        return spawn('powershell', ['-NoProfile', '-Command', psScript], {
            stdio: 'ignore',
            shell: false,
            detached: true,   // 让音效在本进程退出后也能播完（长音频不被打断）
            windowsHide: true  // 不闪黑窗
        });
    }

    /**
     * 播放蜂鸣声作为备用方案
     */
    playBeep() {
        const psScript = '[console]::Beep(800, 500)';
        return spawn('powershell', ['-NoProfile', '-Command', psScript], {
            stdio: 'ignore',
            shell: false,
            windowsHide: true
        });
    }

    /**
     * 发送声音提醒
     */
    async sendSoundNotification() {
        if (!this.config.notification.sound.enabled) {
            return;
        }

        console.log('🔊 播放声音提醒...');

        try {
            const soundProcess = this.playWindowsSound();

            soundProcess.on('error', (error) => {
                if (this.config.notification.sound.backup) {
                    console.log('声音播放失败，使用蜂鸣声');
                    this.playBeep();
                }
            });

            soundProcess.on('close', (code) => {
                if (code !== 0 && this.config.notification.sound.backup) {
                    console.log('声音播放异常，使用蜂鸣声');
                    this.playBeep();
                }
            });

        } catch (error) {
            if (this.config.notification.sound.backup) {
                console.log('播放声音时发生错误，使用蜂鸣声');
                this.playBeep();
            }
        }
    }

    /**
     * 发送飞书通知
     */
    async sendFeishuNotification(taskInfo) {
        if (!this.config.notification.feishu.enabled) {
            console.log('📱 飞书通知已禁用');
            return false;
        }

        const webhookUrl = this.config.notification.feishu.webhook_url;

        if (!webhookUrl || webhookUrl.includes('YOUR_WEBHOOK_URL_HERE')) {
            console.log('⚠️  请先配置飞书webhook地址');
            this.printFeishuSetupGuide();
            return false;
        }

        return await sendFeishuNotification(taskInfo, webhookUrl, this.projectName);
    }

    /**
     * 发送所有类型的通知
     */
    async sendAllNotifications(taskInfo = "Claude Code任务已完成") {
        const icons = this.notificationManager.getEnabledNotificationIcons();
        console.log(`🚀 开始发送任务完成通知... ${icons}`);
        console.log(`📁 项目名称：${this.projectName}`);
        console.log(`📝 任务信息：${taskInfo}`);

        // 发送所有通知
        const results = await this.notificationManager.sendAllNotifications(taskInfo);

        // 添加声音通知
        if (this.config.notification.sound.enabled) {
            this.sendSoundNotification();
            setTimeout(() => {
                console.log('🔊 声音提醒已播放');
            }, 1000);
        }

        // 打印结果汇总
        this.notificationManager.printNotificationSummary(results);

        // 3秒后退出
        setTimeout(() => {
            console.log('✨ 通知系统执行完成，程序退出');
            process.exit(0);
        }, 3000);
    }
}

/**
 * 获取命令行参数
 */
function getCommandLineArgs() {
    const args = process.argv.slice(2);
    const options = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
            options[key] = value;
            if (value !== true) i++;
        }
    }

    return options;
}

/**
 * 从 stdin 读取 Claude Stop hook 传入的上下文
 * 包含 last_assistant_message 等信息
 */
function readStdinSync() {
    const { readFileSync } = require('fs');
    try {
        return readFileSync(0, 'utf8').trim();
    } catch {
        return '';
    }
}

/**
 * 从 Claude 上下文生成通知消息
 */
function buildMessageFromContext(options) {
    // 1. 命令行显式指定了消息，直接用
    if (options.message || options.task) {
        return options.message || options.task;
    }

    // 2. 尝试从 stdin 读取 Claude Stop hook 的 JSON 上下文
    const stdin = readStdinSync();
    if (stdin) {
        try {
            const ctx = JSON.parse(stdin);
            if (ctx.last_assistant_message) {
                const text = ctx.last_assistant_message
                    .split('\n')
                    .filter(line => line.trim() && !line.startsWith('#'))
                    .slice(0, 5)
                    .join(' ')
                    .slice(0, 4000);
                return text || '任务完成';
            }
        } catch {
            // stdin 不是 JSON，忽略
        }
    }

    return '任务完成';
}

// 如果直接运行此脚本
if (require.main === module) {
    const options = getCommandLineArgs();
    const taskInfo = buildMessageFromContext(options);

    const notifier = new NotificationSystem(options);
    notifier.sendAllNotifications(taskInfo);
}

module.exports = {
    NotificationSystem
};