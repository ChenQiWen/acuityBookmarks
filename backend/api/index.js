/**
 * Vercel Serverless Function 适配层
 * 将 Bun 原生服务器适配到 Vercel Serverless Functions
 */

// 由于 Vercel 不直接支持 Bun runtime，这里需要重新实现主要逻辑
import { v4 as uuidv4 } from 'uuid';

// === 简单的内存存储 (用于 Serverless 环境) ===
const jobStore = new Map();

// === 工具函数 ===
function getJob(jobId) {
    return jobStore.get(jobId);
}

function setJob(jobId, data) {
    jobStore.set(jobId, data);
}

// === CORS 配置 ===
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

// === 响应工具函数 ===
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}

// === 主要处理逻辑 ===
async function handleRequest(url, request) {
    const { pathname, searchParams } = url;
    const method = request.method;

    // CORS 预检请求
    if (method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: corsHeaders,
        });
    }

    // 健康检查
    if (pathname === '/health') {
        return jsonResponse({
            status: 'ok',
            timestamp: new Date().toISOString(),
            environment: 'vercel-serverless',
            runtime: 'node',
        });
    }

    // AI LLM 处理端点
    if (pathname.startsWith('/api/ai/')) {
        const action = pathname.split('/').pop();

        if (method === 'POST') {
            try {
                const body = await request.json();

                switch (action) {
                    case 'analyze':
                        // AI 分析逻辑
                        const jobId = uuidv4();
                        setJob(jobId, {
                            status: 'processing',
                            input: body,
                            createdAt: new Date().toISOString(),
                        });

                        // 模拟AI处理过程
                        setTimeout(() => {
                            setJob(jobId, {
                                status: 'completed',
                                input: body,
                                result: {
                                    analysis: '这是AI分析结果的模拟数据',
                                    confidence: 0.95,
                                    suggestions: ['建议1', '建议2', '建议3'],
                                },
                                completedAt: new Date().toISOString(),
                            });
                        }, 2000);

                        return jsonResponse({
                            jobId,
                            status: 'accepted',
                            message: 'AI分析任务已创建',
                        });

                    case 'query':
                        // AI 查询逻辑
                        return jsonResponse({
                            response: '这是AI查询的模拟响应',
                            model: 'gpt-3.5-turbo',
                            timestamp: new Date().toISOString(),
                        });

                    default:
                        return jsonResponse({
                            error: 'Unknown AI action',
                            availableActions: ['analyze', 'query'],
                        }, 404);
                }
            } catch (error) {
                return jsonResponse({
                    error: 'Invalid JSON body',
                    message: error.message,
                }, 400);
            }
        }
    }

    // 网络抓包处理端点
    if (pathname.startsWith('/api/scraper/')) {
        const action = pathname.split('/').pop();

        if (method === 'POST') {
            try {
                const body = await request.json();
                const { url: targetUrl, options = {} } = body;

                if (!targetUrl) {
                    return jsonResponse({
                        error: 'Missing required parameter: url',
                    }, 400);
                }

                switch (action) {
                    case 'fetch':
                        // 网页抓取逻辑
                        const jobId = uuidv4();
                        setJob(jobId, {
                            status: 'processing',
                            targetUrl,
                            options,
                            createdAt: new Date().toISOString(),
                        });

                        // 模拟抓取过程
                        setTimeout(async () => {
                            try {
                                const response = await fetch(targetUrl, {
                                    headers: {
                                        'User-Agent': options.userAgent || 'AcuityBookmarks/1.0',
                                    },
                                });

                                const content = await response.text();

                                setJob(jobId, {
                                    status: 'completed',
                                    targetUrl,
                                    result: {
                                        statusCode: response.status,
                                        headers: Object.fromEntries(response.headers),
                                        content: content.substring(0, 10000), // 限制内容长度
                                        size: content.length,
                                    },
                                    completedAt: new Date().toISOString(),
                                });
                            } catch (error) {
                                setJob(jobId, {
                                    status: 'error',
                                    targetUrl,
                                    error: error.message,
                                    failedAt: new Date().toISOString(),
                                });
                            }
                        }, 1000);

                        return jsonResponse({
                            jobId,
                            status: 'accepted',
                            message: '网页抓取任务已创建',
                        });

                    default:
                        return jsonResponse({
                            error: 'Unknown scraper action',
                            availableActions: ['fetch'],
                        }, 404);
                }
            } catch (error) {
                return jsonResponse({
                    error: 'Invalid JSON body',
                    message: error.message,
                }, 400);
            }
        }
    }

    // 任务状态查询
    if (pathname.startsWith('/api/job/')) {
        const jobId = pathname.split('/').pop();

        if (method === 'GET') {
            const job = getJob(jobId);

            if (!job) {
                return jsonResponse({
                    error: 'Job not found',
                    jobId,
                }, 404);
            }

            return jsonResponse(job);
        }
    }

    // API 根路径
    if (pathname === '/api' || pathname === '/api/') {
        return jsonResponse({
            name: 'AcuityBookmarks Serverless API',
            version: '1.0.0',
            environment: 'vercel',
            endpoints: {
                health: '/health',
                ai: {
                    analyze: 'POST /api/ai/analyze',
                    query: 'POST /api/ai/query',
                },
                scraper: {
                    fetch: 'POST /api/scraper/fetch',
                },
                job: 'GET /api/job/{jobId}',
            },
        });
    }

    // 404 处理
    return jsonResponse({
        error: 'Not Found',
        path: pathname,
        method,
        timestamp: new Date().toISOString(),
    }, 404);
}

// === Vercel Serverless Function 导出 ===
export default async function handler(req, res) {
    const startTime = Date.now();

    try {
        const url = new URL(req.url, `https://${req.headers.host}`);
        const request = {
            method: req.method,
            headers: req.headers,
            json: async () => req.body,
        };

        const response = await handleRequest(url, request);
        const data = await response.json();

        // 添加性能信息
        const responseTime = Date.now() - startTime;

        res.status(response.status);
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        res.setHeader('X-Powered-By', 'AcuityBookmarks-Serverless');

        // 设置 CORS 头
        Object.entries(corsHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
        });

        res.json(data);

    } catch (error) {
        console.error('Serverless function error:', error);

        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
}
