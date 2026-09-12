# 部署到 GitHub（只给自己看）

## 先说结论：GitHub Pages 做不到"私有"

GitHub Pages 的站点**永远是公开可访问的**——任何人拿到网址都能打开，没有密码、没有登录。
把仓库设成私有并不会让站点变私有：

- **仓库私有**只保护源码，不影响站点本身；
- 私有仓库要开 Pages，需要 **GitHub Pro / Team / Enterprise**（免费账号只能用公开仓库开 Pages）；
- 真正能"限制谁能访问"的私有 Pages，只有 **GitHub Enterprise Cloud 的组织**才有。

所以"部署到 GitHub 又不想被人看见"这两件事，只能在下面三种做法里选一种绕过去。

## 一个让人安心的前提

这个工具是纯前端应用，**你做的品书不会上传到任何服务器**——所有内容都存在你自己浏览器的
localStorage 里。也就是说，就算站点是公开的，别人打开也只能看到一个空的工具，
看不到你排的任何一张品书。会被看到的只是这个工具本身。

---

## 做法 A：私有仓库 + Cloudflare Pages + Access（推荐）

源码放在 GitHub 私有仓库，站点交给 Cloudflare 托管，并用 Access 加一道登录门。

1. GitHub 新建一个 **Private** 仓库（比如 `bookmenu-maker`），把本项目推上去；
2. 到 Cloudflare 控制台 → Workers & Pages → 创建 Pages → 连接 Git → 选这个私有仓库；
   - 构建命令：**留空**（本项目没有构建步骤）
   - 输出目录：`/`
3. 到 Cloudflare Zero Trust → Access → Applications，新建一个 **Self-hosted** 应用，
   域名填 Pages 给你的地址，策略设为 `Allow` + 你的邮箱；
4. 完成。之后任何人打开这个网址都会先被 Cloudflare 拦住，只有你点邮件里的验证码才能进。

免费额度对个人使用绰绰有余（Access 免费版支持 50 个用户）。
优点：**真正的私有**，且源码不公开。缺点：多一个 Cloudflare 账号。

## 做法 B：私有仓库 + GitHub Pages（需要 GitHub Pro）

只想待在 GitHub 生态里的折中方案。

1. 仓库 Settings → Pages → Source 选 `main` / `/ (root)`；
2. 站点地址是 `https://<你的用户名>.github.io/<仓库名>/`；
3. 因为仓库是私有的，**源码不会公开**，站点也不会被搜索引擎主动收录。

注意：**这仍然是"隐蔽"，不是"私有"**——猜不到不等于打不开，
任何拿到链接的人都能直接访问。如果只是想避免被人顺手翻到，这个程度够用。

想再稳一点，可以在 `index.html` 的 `<head>` 里加一行，明确告诉搜索引擎别收录：

```html
<meta name="robots" content="noindex, nofollow">
```

## 做法 C：根本不发布到公网

如果只是在展会前用，其实不需要公网：

```bash
cd "品书生成器"
python3 -m http.server 8000     # 然后浏览器打开 http://localhost:8000
```

想在手机或另一台电脑上用，可以装 Tailscale 之类的组网工具，
让那些设备直接访问你这台机器，不经过任何公网服务。

---

## 推送命令（做法 A / B 通用）

仓库已经初始化好、文件也已经暂存，只差填上你的身份然后提交：

```bash
cd "品书生成器"

# 1. 填一次身份（会写进提交记录，建议用 GitHub 账号对应的邮箱）
git config user.name  "你的名字"
git config user.email "你的邮箱"

# 2. 提交
git commit -m "品书生成器 v5：三栏工作台 / 中日双语 / 单张 PNG 导出"

# 3. 关联远端并在 GitHub 上创建私有仓库（二选一）
#    a) 装了 gh 命令行：
gh repo create bookmenu-maker --private --source=. --push
#    b) 网页上新建好私有仓库后：
git remote add origin git@github.com:<你的用户名>/bookmenu-maker.git
git push -u origin main
```

本机 `~/.ssh/id_ed25519.pub` 已经有 SSH 公钥，只要把它加到 GitHub 账号的
Settings → SSH and GPG keys 里，用上面的 SSH 地址推送就不必再输密码。

## 关于体积

仓库约 18MB，绝大部分是自带的 Noto 中日文字体（离线可用、导出不依赖 CDN）。
远低于 GitHub 单文件 100MB 的限制，正常推送即可。

`legacy/`（旧版单文件工具）已在 `.gitignore` 里排除，不会发布。
