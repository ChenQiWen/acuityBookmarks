# AcuityBookmarks Backend

基于 Vercel + Supabase 的 AI 书签搜索后端服务

## 🚀 部署到 Vercel

### 1. 环境变量配置

在 Vercel 项目中设置以下环境变量：

```bash
# Supabase 配置
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Gemini API (用于生成向量嵌入)
GEMINI_API_KEY=your_gemini_api_key

# Vercel URL (用于内部 API 调用)
VERCEL_URL=https://your-vercel-app.vercel.app

# 可选: OpenAI API (备用)
OPENAI_API_KEY=your_openai_api_key
```

### 2. Supabase 数据库表结构

创建以下表：

#### `bookmarks` 表
```sql
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_content ON bookmarks USING gin(to_tsvector('english', content));
```

#### `embeddings` 表
```sql
CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  bookmark_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  embedding VECTOR(768), -- pgvector 扩展
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bookmark_id, user_id)
);

-- 创建向量索引 (需要 pgvector 扩展)
CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops);
```

### 3. API 端点

#### `/api/bookmarks/upload`
上传书签数据并生成向量嵌入
```javascript
POST /api/bookmarks/upload
{
  "bookmarks": [...],
  "userId": "user123"
}
```

#### `/api/search/embeddings`
AI 向量搜索
```javascript
POST /api/search/embeddings
{
  "query": "化妆品",
  "userId": "user123",
  "mode": "hybrid", // "vector" | "keyword" | "hybrid"
  "limit": 20
}
```

#### `/api/bookmarks/sync`
书签数据同步
```javascript
POST /api/bookmarks/sync
{
  "userId": "user123",
  "syncType": "incremental", // "incremental" | "full" | "stats"
  "changes": {
    "added": [...],
    "updated": [...],
    "deleted": [...]
  }
}
```

## 🛠️ 本地开发

```bash
# 安装依赖
bun install

# 运行测试
bun run test:run

# 启动开发服务器
bun run dev
```

## 📊 架构优势

1. **⚡ 快速响应**: Vercel 全球 CDN，响应速度极快
2. **🧠 AI 增强**: Gemini Embedding + Supabase Vector 搜索
3. **🔄 实时同步**: 增量同步，实时更新
4. **📈 水平扩展**: Vercel + Supabase 自动扩展
5. **💰 成本优化**: 免费额度内可支持大量用户

## 🎯 使用场景

- **用户安装扩展**: 自动上传书签到云端
- **书签变化**: 实时同步更新向量
- **AI 搜索**: 毫秒级语义搜索
- **离线缓存**: 本地缓存常用结果
