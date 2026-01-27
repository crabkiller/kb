const fs = require('fs').promises;
const path = require('path');
const simpleGit = require('simple-git');
const config = require('./config');

class Storage {
  constructor() {
    this.basePath = config.knowledgeBasePath;
    this.git = simpleGit();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    // 确保数据目录存在
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (err) {
      console.error('Failed to create data directory:', err);
    }

    // 初始化 git
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        console.log('Initializing git repository...');
        await this.git.init();
        await this.git.addRemote('origin', config.githubRepoUrl);
      }
    } catch (err) {
      console.error('Git initialization error:', err);
    }

    this.initialized = true;
  }

  async saveKnowledge(filename, content) {
    await this.init();

    const filePath = path.join(this.basePath, filename.endsWith('.md') ? filename : `${filename}.md`);
    
    // 1. 写入文件
    await fs.writeFile(filePath, content, 'utf8');

    // 2. 更新 MCP 索引
    await this.updateMcpIndex(filename, filePath);

    // 3. Git 同步
    await this.syncToGithub(filename);

    return { filename, path: filePath };
  }

  async updateMcpIndex(title, filePath) {
    const indexPath = path.join(this.basePath, config.mcpIndexFile);
    let index = [];

    try {
      const data = await fs.readFile(indexPath, 'utf8');
      index = JSON.parse(data);
    } catch (err) {
      // 文件不存在则创建新数组
    }

    const relativePath = path.relative(this.basePath, filePath);
    const existingIndex = index.findIndex(item => item.path === relativePath);

    const metadata = {
      title,
      path: relativePath,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex > -1) {
      index[existingIndex] = { ...index[existingIndex], ...metadata };
    } else {
      metadata.createdAt = metadata.updatedAt;
      index.push(metadata);
    }

    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
  }

  async syncToGithub(filename) {
    try {
      await this.git.add('./*');
      await this.git.commit(`Add knowledge: ${filename}`);
      // 尝试推送，如果失败（如未配置 SSH）则仅在本地提交
      try {
        await this.git.push('origin', 'main');
      } catch (pushErr) {
        console.warn('Git push failed, changes are committed locally:', pushErr.message);
      }
    } catch (err) {
      console.error('Git sync error:', err);
    }
  }
}

module.exports = new Storage();
