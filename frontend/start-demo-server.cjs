#!/usr/bin/env node

/**
 * 启动本地HTTP服务器，解决CORS问题
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

// MIME类型映射
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
    // 解析URL
    const parsedUrl = url.parse(req.url, true);
    let filePath = path.join(__dirname, parsedUrl.pathname);
    
    // 默认首页
    if (parsedUrl.pathname === '/') {
        filePath = path.join(__dirname, 'smart-font-demo.html');
    }
    
    // 处理字体文件路径
    if (parsedUrl.pathname.startsWith('/fonts/')) {
        filePath = path.join(__dirname, '../dist', parsedUrl.pathname);
    }
    
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // 处理OPTIONS请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 读取文件
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 文件不存在 - 404
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('文件未找到: ' + parsedUrl.pathname);
            } else {
                // 服务器错误 - 500
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('服务器错误');
            }
        } else {
            // 成功 - 200
            const mimeType = getMimeType(filePath);
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(data);
        }
    });
});

server.listen(PORT, () => {
    console.log('🚀 智能字体演示服务器启动成功！');
    console.log('');
    console.log('📺 演示页面地址:');
    console.log(`   http://localhost:${PORT}/smart-font-demo.html`);
    console.log('');
    console.log('🔧 备用页面 (无CORS问题):');
    console.log(`   http://localhost:${PORT}/smart-font-demo-standalone.html`);
    console.log('');
    console.log('🌐 其他演示页面:');
    console.log(`   http://localhost:${PORT}/font-system-detector.html`);
    console.log(`   http://localhost:${PORT}/font-switch-test.html`);
    console.log('');
    console.log('💡 提示:');
    console.log('   - 服务器已启用CORS支持');
    console.log('   - 字体文件路径已正确配置'); 
    console.log('   - 按 Ctrl+C 停止服务器');
    console.log('');
    console.log('🎯 推荐先访问: smart-font-demo-standalone.html (最稳定版本)');
});
