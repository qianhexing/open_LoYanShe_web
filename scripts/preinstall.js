// 检查是否使用了 pnpm 或 bun 作为包管理工具
const isUsingPnpm = /pnpm/.test(process.env.npm_execpath || '')
if (!isUsingPnpm) {
  console.warn(
    `\u001b[33m 本项目中必须使用 pnpm 作为包管理工具。\n` +
    `如果需要使用 pnpm，请运行 'npm i -g pnpm' 或 'npm i pnpm' 安装 pnpm。\n`)
  process.exit(1)
}