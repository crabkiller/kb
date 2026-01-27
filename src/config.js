require('dotenv').config();
const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  githubRepoUrl: process.env.GITHUB_REPO_URL,
  githubToken: process.env.GITHUB_TOKEN,
  // 知识库存储的本地路径（相对于项目根目录）
  knowledgeBasePath: path.resolve(process.cwd(), process.env.KNOWLEDGE_BASE_PATH || './data'),
  // MCP 索引文件名
  mcpIndexFile: 'mcp-list.json'
};
