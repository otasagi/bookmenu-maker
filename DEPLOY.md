# 部署到 GitHub（仓库私有）

目标：**仓库私有，站点公开无所谓**。

## 关键前提

GitHub 官方规则（2026 年 8 月核对）：

> Pages 在公开仓库对 GitHub Free 开放；**私有仓库要用 Pages，需要 GitHub Pro**、
> Team、Enterprise Cloud 或 Enterprise Server。

也就是说，免费账号下"私有仓库 + GitHub Pages"这个组合本身不成立，得二选一：
要么升级到 Pro，要么源码留在 GitHub 私有仓库、站点交给别处托管。

（另外，这个工具是纯前端的，你做的品书全部存在浏览器 localStorage 里，
不会上传到任何地方。公开的只是工具本身。）

---

## 路线一：GitHub Pro（在校学生可以免费领）

最适合"什么都想待在 GitHub 里"的做法。

1. 如果是在校学生：申请 **GitHub Student Developer Pack**，通过后自带 Pro，免费；
2. 仓库 Settings → General → 拉到最下面 Danger Zone → **Change visibility → Private**；
3. 仓库 Settings → Pages → Source 选 `main` / `/ (root)`；
4. 稍等一分钟，站点地址是 `https://otasagi.github.io/bookmenu-maker/`。

站点公开访问，但源码不公开，搜索引擎也不会主动收录。

## 路线二：免费账号——源码私有 + 站点托管到别处

仓库保持私有，站点交给支持"连接私有仓库"的免费托管服务。推荐 Cloudflare Pages：

1. GitHub 上建 **Private** 仓库，把本项目推上去（见下方命令）；
2. Cloudflare 控制台 → Workers & Pages → 创建 → Pages → 连接 Git → 选这个私有仓库；
   - 构建命令：**留空**（本项目没有构建步骤）
   - 输出目录：`/`
3. 部署完拿到一个 `xxx.pages.dev` 地址，站点公开、仓库私有，完全免费。

同理也可以连 Netlify 或 Vercel，做法一样：连接私有仓库、构建命令留空。

---

## 推送命令

本地仓库已经初始化、首次提交也已完成，远端已指向
`git@github.com:otasagi/bookmenu-maker.git`。只差在 GitHub 上把仓库建出来：

1. 打开 https://github.com/new?name=bookmenu-maker&visibility=private
   （名字想换就换，换完同步改一下远端即可：`git remote set-url origin git@github.com:otasagi/<新名字>.git`）
2. **不要**勾选 “Add a README file”、“Add .gitignore”、“Choose a license”——本地已经有内容了；
3. 建好后执行：

```bash
cd "品书生成器"
git push -u origin main
```

本机 `~/.ssh/id_ed25519.pub` 已经绑定到 GitHub 账号，推送不会再要求输密码。

## 关于体积

仓库约 18MB，绝大部分是自带的 Noto 中日文字体（为了离线可用、导出不依赖 CDN）。
远低于 GitHub 单文件 100MB 的限制。

`legacy/`（旧版单文件工具）已在 `.gitignore` 中排除，不会发布。

## 更新之后：让浏览器丢掉旧文件

站点是纯静态的，没有构建哈希，浏览器会把 `js/`、`styles/` 里的文件各自缓存。
所以**推送新版本后第一次打开，有可能只刷新了其中一部分文件**，出现"界面正常、
但版面/导出不对"的怪现象（曾经出现过卡片被压成细条）。

现在页面启动时会核对版本号（`styles/app.css` 的 `--app-build` 与 `js/main.js` 的 `BUILD`），
不一致会直接在下方提示强制刷新。自己遇到版面错乱时，先按 **⌘/Ctrl + Shift + R** 强刷一次再看。

改动界面相关的文件后，记得把这两个数字一起加一。
