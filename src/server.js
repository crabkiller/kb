const Koa = require('koa');
const Router = require('@koa/router');
const { koaBody } = require('koa-body');
const fs = require('fs').promises;
const config = require('./config');
const storage = require('./storage');

const app = new Koa();
const router = new Router();

app.use(koaBody({
  multipart: true,
  formidable: {
    keepExtensions: true,
  }
}));

// 采集接口
router.post('/collect', async (ctx) => {
  const { title: bodyTitle, tags = [] } = ctx.request.body;
  const file = ctx.request.files?.file;

  if (!file) {
    ctx.status = 400;
    ctx.body = { error: 'File is required' };
    return;
  }

  try {
    const content = await fs.readFile(file.filepath, 'utf8');
    const title = bodyTitle || file.originalFilename.replace(/\.md$/, '');

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
