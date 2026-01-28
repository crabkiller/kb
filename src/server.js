const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');
const config = require('./config');
const storage = require('./storage');

const app = new Koa();
const router = new Router();

app.use(bodyParser());

// 采集接口
router.post('/collect', async (ctx) => {
  const { title, content, tags = [] } = ctx.request.body;

  console.log('title', title, content);

  if (!title || !content) {
    ctx.status = 400;
    ctx.body = { error: 'Title and content are required' };
    return;
  }

  try {
    const result = await storage.saveKnowledge(title, content, tags);
    ctx.body = {
      message: 'Knowledge collected successfully',
      data: result
    };
  } catch (err) {
    console.error('Collection error:', err);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 健康检查
router.get('/health', (ctx) => {
  ctx.body = { status: 'ok' };
});

app.use(router.routes()).use(router.allowedMethods());

app.listen(config.port, () => {
  console.log(`Knowledge Collector running at http://localhost:${config.port}`);
});
