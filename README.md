# Podcast 后端 API

一个用于解析和提供播客 RSS/Atom 订阅源的后端 API 服务。

## 项目结构

```
backend/
  bin/                # 启动脚本
    start.js          # 服务器启动脚本
  routes/
    feed.js           # 播客订阅源 API 路由
  app.js              # Express 应用主入口
  package.json        # 依赖与脚本
  README.md           # 项目说明
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
# 生产环境
npm start

# 开发环境（需要安装nodemon）
npm run dev
```

服务启动后，API 基础地址为：`http://localhost:3000`

## API 接口

### 1. 获取单个播客订阅源

**接口**：`GET /api/feed?url=订阅源地址`

**示例**：

```
http://localhost:3000/api/feed?url=https://www.ximalaya.com/album/3558668.xml
```

**参数**：

- `url`（必填）：播客 RSS/Atom 订阅源的完整 URL

### 2. 批量获取内置播客源

**接口**：`GET /api/feed?all=1`

**示例**：

```
http://localhost:3000/api/feed?all=1
```

**参数**：

- `all=1`（必填）：返回后端内置的所有播客源

## 返回数据结构

### 单个订阅源返回示例

```json
{
  "url": "https://...",
  "info": {
    "title": "播客标题",
    "description": "播客简介",
    "link": "官网链接",
    "image": "封面图片",
    "author": "作者",
    "language": "语言",
    "copyright": "版权信息"
  },
  "episodes": [
    {
      "title": "单集标题",
      "description": "单集简介",
      "pubDate": "发布时间",
      "audioUrl": "音频地址",
      "duration": "时长",
      "image": "单集封面",
      "guid": "唯一标识"
    }
  ]
}
```

### 批量返回示例

返回为上述结构的数组，每个元素对应一个订阅源。

## 内置播客源

系统内置了以下播客订阅源：

- `https://www.ximalaya.com/album/3558668.xml`
- `https://rss.lizhi.fm/rss/21628.xml`
- `https://data.getpodcast.xyz/data/ximalaya/246622.xml`
- `http://feed.tangsuanradio.com/gadio.xml`
- `https://www.ximalaya.com/album/5574153.xml`
- `https://bitvoice.banlan.show/feed/audio.xml`
- `https://keepcalm.banlan.show/feed/audio.xml`

## 技术栈

- **Node.js** - 运行环境
- **Koa** - Web 框架
- **koa-router** - 路由中间件
- **koa-bodyparser** - 请求体解析中间件
- **@koa/cors** - 跨域支持中间件
- **axios** - HTTP 客户端
- **fast-xml-parser** - XML 解析器

## 功能特性

- 基于 Koa2 框架，支持 async/await 异步编程
- 支持 RSS 和 Atom 两种订阅源格式
- 自动解析播客信息和单集列表
- 内置多个热门播客源
- 支持批量获取和单个获取
- 完善的错误处理机制
- 跨域支持
- 轻量级、高性能的中间件架构

## 环境变量

- `PORT` - 服务端口号（默认：3000）

## 错误处理

API 会返回标准的 HTTP 状态码：

- `200` - 成功
- `400` - 请求参数错误
- `404` - 接口不存在
- `500` - 服务器内部错误

错误响应格式：

```json
{
  "error": "错误类型",
  "message": "错误详细信息"
}
```

## 开发说明

### 添加新的内置播客源

在 `routes/feed.js` 文件中的 `BUILT_IN_FEEDS` 数组中添加新的 RSS/Atom 订阅源 URL。

### 自定义 XML 解析

可以在 `routes/feed.js` 中修改 `xmlParserOptions` 配置来调整 XML 解析行为。

## 许可证

MIT License
