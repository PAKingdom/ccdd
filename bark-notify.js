/**
 * Bark 通知脚本 - iOS 推送提醒版
 * 通过 Bark 服务器（默认 https://api.day.app）推送消息到 iPhone
 */

require('dotenv').config();
const https = require('https');
const http = require('http');

/**
 * Bark 推送通知类
 */
class BarkNotifier {
    /**
     * 构造函数
     * @param {string} deviceKey - Bark 设备 key（App 首页复制）
     * @param {string} server - Bark 服务器地址，默认 https://api.day.app
     */
    constructor(deviceKey, server = 'https://api.day.app') {
        this.deviceKey = deviceKey;
        // 去掉结尾斜杠，避免拼出双斜杠
        this.server = (server || 'https://api.day.app').replace(/\/+$/, '');
    }

    /**
     * 发送推送到 Bark
     * @param {string} title - 通知标题
     * @param {string} body - 通知内容
     * @param {Object} options - 额外选项（group / sound / icon / level 等）
     * @returns {Promise<boolean>} 发送是否成功
     */
    async send(title, body, options = {}) {
        const payload = {
            title: title,
            body: body,
            group: 'Claude Code',
            ...options
        };

        return this._sendPayload(payload);
    }

    /**
     * 发送 HTTP 请求到 Bark 服务器
     * POST ${server}/${deviceKey}  body: {title, body, ...}
     * @param {Object} payload - 请求载荷
     * @returns {Promise<boolean>} 发送是否成功
     */
    _sendPayload(payload) {
        return new Promise((resolve) => {
            const data = JSON.stringify(payload);
            const url = new URL(`${this.server}/${this.deviceKey}`);

            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const protocol = url.protocol === 'https:' ? https : http;

            const req = protocol.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const result = JSON.parse(responseData);
                        if (result.code === 200) {
                            console.log('✅ Bark 通知发送成功');
                            resolve(true);
                        } else {
                            console.error('❌ Bark 通知发送失败:', result.message || responseData);
                            resolve(false);
                        }
                    } catch (error) {
                        console.error('❌ 解析 Bark 响应失败:', responseData || error.message);
                        resolve(false);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('❌ 发送 Bark 请求失败:', error.message);
                resolve(false);
            });

            req.write(data);
            req.end();
        });
    }
}

/**
 * 任务完成通知函数
 * @param {string} taskInfo - 任务信息
 * @param {Object} barkConfig - Bark 配置 { key, server }
 * @param {string} projectName - 项目名称
 * @returns {Promise<boolean>} 发送是否成功
 */
async function notifyTaskCompletion(taskInfo = 'Claude Code任务已完成', barkConfig = {}, projectName = '') {
    const deviceKey = barkConfig.key || process.env.BARK_KEY || '';
    const server = barkConfig.server || process.env.BARK_SERVER || 'https://api.day.app';

    if (!deviceKey || deviceKey.includes('your_bark_device_key_here')) {
        console.log('⚠️  请先配置 Bark 设备 key');
        console.log('📝 配置方法：');
        console.log('1. 安装 Bark App（iOS）');
        console.log('2. 打开 App 首页，复制「设备 key」（如 https://api.day.app/AbCd1234.../ 里的 AbCd1234...）');
        console.log('3. 在 .env 中设置 BARK_KEY');
        return false;
    }

    const notifier = new BarkNotifier(deviceKey, server);

    const title = projectName ? `${projectName}` : 'Claude Code';
    const body = `${taskInfo}\n${new Date().toLocaleString('zh-CN')}`;

    try {
        const success = await notifier.send(title, body);

        if (success) {
            console.log('🎉 任务完成通知已推送到 Bark！');
            console.log('📱 您的 iPhone 将收到推送通知');
        } else {
            console.log('❌ Bark 通知发送失败，请检查 BARK_KEY / BARK_SERVER 配置');
        }

        return success;
    } catch (error) {
        console.error('❌ 发送 Bark 通知时发生错误:', error.message);
        return false;
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
            if (value !== true) i++; // 跳过下一个参数，因为它已经被当作值处理了
        }
    }

    return options;
}

// 如果直接运行此脚本
if (require.main === module) {
    const options = getCommandLineArgs();
    const taskInfo = options.message || options.task || 'Claude Code任务已完成';

    console.log('🚀 开始发送 Bark 通知...');
    notifyTaskCompletion(taskInfo, {}, options.project || '');
}

module.exports = {
    BarkNotifier,
    notifyTaskCompletion
};
