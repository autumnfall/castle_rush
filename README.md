# 🏰 城堡突袭

单人策略卡牌游戏，支持基础规则、指挥官扩展、城防扩展和组合模式。使用原生 HTML、CSS 和 ES Modules，无运行时第三方依赖或后端。

游戏地址：https://autumnfall.github.io/castle_rush/

## 本地运行

使用 Node.js 22 或更新版本：

```sh
npm start
```

打开 http://127.0.0.1:8080 。按 Ctrl+C 停止服务。无需安装依赖即可游玩；不要通过 `file://` 打开，浏览器需要通过 HTTP 加载 ES Modules。

## 测试和构建

```sh
npm ci
npx playwright install --with-deps chromium
npm test
npm run build
npm run preview
```

测试会自动构建 `dist/` 并启动前台预览服务器，结束后自动停止。8080 端口需空闲。测试包括指挥官技能、城防阶段、协同、疲劳、手机布局，以及 `/castle_rush/` 子路径资源加载。

`npm run build` 仅复制 `index.html`、`css/`、`js/`、`assets/` 并生成 `.nojekyll`，产物位于 `dist/`。`npm run preview` 预览该产物，也支持 http://127.0.0.1:8080/castle_rush/ 。开发预览服务仅绑定本机。

## GitHub Pages

工作流位于 [`.github/workflows/pages.yml`](.github/workflows/pages.yml)。首次发布需在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**：

https://github.com/autumnfall/castle_rush/settings/pages

推送到 `master` 后自动安装测试依赖、执行 Chromium 回归测试，再发布 `dist/`；拉取请求仅测试。也可从 **Actions → Test and deploy to GitHub Pages → Run workflow** 手动发布。测试失败时不部署，可在工作流附件中查看失败记录。

Pages 使用相对资源路径，适配项目地址 `/castle_rush/`。无需配置域名或应用服务器。

## 代码结构

- `js/core.js`：初始化、抽牌、覆盖关系、胜负和回合阶段。
- `js/combat.js`：攻城与防御结算。
- `js/commanders.js`：指挥官配置和技能。
- `js/skills.js`：战术、协同与技能选择流程。
- `js/board.js`、`js/ui.js`、`js/main.js`：棋盘渲染、界面和交互入口。
- `tests/`：Playwright 浏览器回归测试。
