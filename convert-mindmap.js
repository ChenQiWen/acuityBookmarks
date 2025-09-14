#!/usr/bin/env node

/**
 * 测试用例思维导图转换工具
 * 将JSON格式转换为其他思维导图工具支持的格式
 */

const fs = require('fs');
const path = require('path');

// 读取JSON格式的思维导图
function loadMindmapData() {
  try {
    const data = fs.readFileSync('./test-mindmap.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ 无法读取 test-mindmap.json 文件:', error.message);
    process.exit(1);
  }
}

// 转换为Markdown格式
function convertToMarkdown(data) {
  let markdown = `# ${data.meta.name}\n\n`;
  markdown += `> ${data.meta.description}\n\n`;
  markdown += `📊 **总计测试用例**: ${data.meta.totalTests}个\n\n`;
  markdown += `📁 **总计测试文件**: ${data.meta.totalFiles}个\n\n`;

  function processNode(node, level = 1) {
    const indent = '#'.repeat(level + 1);
    let result = `${indent} ${node.title}\n`;

    if (node.note) {
      result += `> ${node.note}\n`;
    }

    if (node.children && node.children.length > 0) {
      result += '\n';
      node.children.forEach(child => {
        result += processNode(child, level + 1);
      });
    }

    return result;
  }

  markdown += processNode(data.root);
  return markdown;
}

// 转换为FreeMind格式 (基本的.mm格式)
function convertToFreeMind(data) {
  let mmContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
  mmContent += '<map version="1.0.1">\n';

  function processNode(node, level = 0) {
    const indent = '  '.repeat(level);
    let result = `${indent}<node TEXT="${node.title.replace(/"/g, '&quot;')}"`;

    if (node.note) {
      result += `>\n${indent}  <richcontent type="NOTE"><html><head></head><body>${node.note}</body></html></richcontent>\n`;
    } else {
      result += '>\n';
    }

    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        result += processNode(child, level + 1);
      });
    }

    result += `${indent}</node>\n`;
    return result;
  }

  mmContent += processNode(data.root);
  mmContent += '</map>\n';

  return mmContent;
}

// 主函数
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('📋 使用方法:');
    console.log('  bun convert-mindmap.js markdown  # 转换为Markdown格式');
    console.log('  bun convert-mindmap.js freemind  # 转换为FreeMind格式');
    console.log('  bun convert-mindmap.js all        # 生成所有格式');
    return;
  }

  const format = args[0].toLowerCase();
  const data = loadMindmapData();

  console.log(`🔄 开始转换测试用例思维导图...`);
  console.log(`📊 总计测试用例: ${data.meta.totalTests}个`);
  console.log(`📁 总计测试文件: ${data.meta.totalFiles}个\n`);

  switch (format) {
    case 'markdown':
    case 'md':
      const markdown = convertToMarkdown(data);
      fs.writeFileSync('./test-mindmap.md', markdown);
      console.log('✅ 已生成: test-mindmap.md');
      break;

    case 'freemind':
    case 'mm':
      const freemind = convertToFreeMind(data);
      fs.writeFileSync('./test-mindmap.mm', freemind);
      console.log('✅ 已生成: test-mindmap.mm');
      break;

    case 'all':
      // 生成所有格式
      const md = convertToMarkdown(data);
      const mm = convertToFreeMind(data);

      fs.writeFileSync('./test-mindmap.md', md);
      fs.writeFileSync('./test-mindmap.mm', mm);

      console.log('✅ 已生成所有格式:');
      console.log('  - test-mindmap.md (Markdown)');
      console.log('  - test-mindmap.mm (FreeMind)');
      break;

    default:
      console.log('❌ 不支持的格式。可用格式: markdown, freemind, all');
      break;
  }

  console.log('\n🎯 转换完成！');
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  loadMindmapData,
  convertToMarkdown,
  convertToFreeMind
};
