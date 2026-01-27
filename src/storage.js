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

  async saveKnowledge(filename, content, tags = []) {
    await this.init();

    const filePath = path.join(this.basePath, filename.endsWith('.md') ? filename : `${filename}.md`);
    
    // 1. 写入文件
    await fs.writeFile(filePath, content, 'utf8');

    // 2. 提取核心知识点摘要
    const summary = this.extractSummary(content);

    // 3. 更新 MCP 索引
    await this.updateMcpIndex(filename, filePath, summary, tags);

    // 4. Git 同步
    await this.syncToGithub(filename);

    return { filename, path: filePath };
  }

  /**
   * 从 Markdown 内容中提取「核心知识点」章节
   * 用于 RAG 快速匹配，避免读取完整文件
   */
  extractSummary(content) {
    // 匹配 "## 核心知识点" 到下一个 "##" 标题之间的内容
    const summaryMatch = content.match(/##\s*核心知识点\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i);
    if (summaryMatch && summaryMatch[1]) {
      return summaryMatch[1].trim();
    }
    
    // 如果没有找到核心知识点章节，尝试提取前 500 字符作为摘要
    const cleanContent = content.replace(/^#.*\n/, '').trim();
    return cleanContent.substring(0, 500) + (cleanContent.length > 500 ? '...' : '');
  }

  async updateMcpIndex(title, filePath, summary, tags = []) {
    const indexPath = path.join(process.cwd(), config.mcpResourcesListFile);
    let resources = [];

    try {
      const data = await fs.readFile(indexPath, 'utf8');
      const json = JSON.parse(data);
      resources = json.result.resources || [];
    } catch (err) {
      // 文件不存在或格式错误则创建新数组
    }

    const filename = path.basename(filePath);
    const uri = `${config.githubRawBaseUrl}/${encodeURIComponent(filename)}`;
    const existingIndex = resources.findIndex(item => item.uri === uri);

    const resource = {
      uri,
      name: title,
      description: `核心知识点：${summary}`,
      mimeType: "text/markdown"
    };

    if (existingIndex > -1) {
      resources[existingIndex] = resource;
    } else {
      resources.push(resource);
    }

    const output = {
      jsonrpc: "2.0",
      id: 1,
      result: {
        resources
      }
    };

    await fs.writeFile(indexPath, JSON.stringify(output, null, 2), 'utf8');
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
