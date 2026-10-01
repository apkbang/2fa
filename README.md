# APKBang 2FA 网页源码

独立静态页面，适合放在 GitHub 仓库或开启 GitHub Pages。无需 PHP、数据库、构建工具或第三方脚本。

## 文件

- `index.html`：页面与直达链接入口
- `404.html`：GitHub Pages 的 `/2fa/密钥` 路径回退页，与 `index.html` 内容相同
- `style.css`：桌面与手机样式
- `app.js`：浏览器 Web Crypto 计算 TOTP
- `logo.webp`：APKBang 标识，左上角点击始终前往 `https://www.apkbang.com/`

## 上传和使用

将压缩包内文件放到 GitHub 仓库根目录。在仓库 Settings → Pages 中选择从 `main` 分支根目录发布。页面地址通常是 `https://<用户名>.github.io/<仓库名>/`。使用 HTTPS 打开，直接输入 Base32 密钥或标准 `otpauth://totp/...` 链接。

支持下列直达形式：

- `https://<站点>/2fa/<Base32密钥>`
- `https://<站点>/2fa/agent/<渠道码>/<Base32密钥>`
- `https://<站点>/?secret=<Base32密钥>`
- `https://<站点>/#secret=<Base32密钥>`（推荐，不发送密钥到托管服务器）

GitHub Pages 没有动态路由。前两种路径依靠 `404.html` 在浏览器中显示工具，但 HTTP 状态仍是 404；需要 HTTP 200 的直达链接请使用根目录的查询参数或 `#secret=` 形式。若部署到自己的 Nginx，可把 `/2fa/*` 回退到 `index.html`。

浏览器会尽快从地址栏移除直达链接中的密钥，但路径及查询参数形式的首次 HTTP 请求仍可能被托管服务记录。不要公开分享包含真实密钥的链接。页面不保存密钥、不向后台提交密钥；TOTP 使用 SHA-1、6 位、30 秒。非此参数的 `otpauth` 链接会显示错误，避免生成错误验证码。

验证码始终使用本机时间计算，不请求任何时间服务。因此页面既可以在 GitHub Pages 使用，也可以直接打开本地 `index.html`。若验证码一直无效，请在设备设置中开启自动日期与时间。
