const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const feedRoutes = require('./routes/feed');

const app = new Koa();
const router = new Router();
const PORT = process.env.PORT || 3000;

// 错误处理中间件
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err.stack);
    ctx.status = err.status || 500;
    ctx.body = {
      error: 'Internal Server Error',
      message: err.message
    };
  }
});

// 中间件
app.use(cors());
app.use(bodyParser());

// 根路径
router.get('/', async (ctx) => {
  ctx.body = {
    message: 'Podcast Backend API',
    version: '1.0.0',
    endpoints: {
      'GET /api/feed?url=<rss_url>': '获取单个播客订阅源',
      'GET /api/feed?all=1': '批量获取内置播客源'
    }
  };
});

// 注册路由
router.use('/api/feed', feedRoutes.routes(), feedRoutes.allowedMethods());

// 应用路由
app.use(router.routes());
app.use(router.allowedMethods());

// 404 处理
app.use(async (ctx) => {
  ctx.status = 404;
  ctx.body = {
    error: 'Not Found',
    message: 'API endpoint not found'
  };
});

app.listen(PORT, () => {
  console.log(`Podcast Backend API server is running on port ${PORT}`);
  console.log(`API base URL: http://localhost:${PORT}/api/feed`);
});
