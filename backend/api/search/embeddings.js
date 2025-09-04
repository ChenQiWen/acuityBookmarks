import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Vercel环境变量
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(geminiApiKey);

// 生成查询的嵌入向量
async function generateQueryEmbedding(query) {
  try {
    const model = genAI.getGenerativeModel({ model: "embedding-001" });
    const result = await model.embedContent(query);
    return result.embedding.values;
  } catch (error) {
    throw new Error('Failed to generate query embedding');
  }
}

// 计算余弦相似度
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 向量相似度搜索
async function searchByEmbeddings(queryEmbedding, userId, limit = 20) {
  try {
    // 获取用户的嵌入向量
    const { data: embeddings, error } = await supabase
      .from('embeddings')
      .select('bookmark_id, embedding')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    if (!embeddings || embeddings.length === 0) {
      return [];
    }


    // 计算相似度
    const similarities = embeddings.map(item => ({
      bookmark_id: item.bookmark_id,
      similarity: cosineSimilarity(queryEmbedding, item.embedding)
    }));

    // 按相似度排序
    similarities.sort((a, b) => b.similarity - a.similarity);

    // 获取前N个结果
    const topResults = similarities.slice(0, limit);

    // 获取对应的书签信息
    const bookmarkIds = topResults.map(item => item.bookmark_id);
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from('bookmarks')
      .select('id, title, url, content')
      .eq('user_id', userId)
      .in('id', bookmarkIds);

    if (bookmarksError) {
      throw bookmarksError;
    }

    // 合并结果
    const results = topResults.map(item => {
      const bookmark = bookmarks.find(b => b.id === item.bookmark_id);
      return {
        ...bookmark,
        similarity: item.similarity,
        score: Math.round(item.similarity * 100) / 100
      };
    });

    return results;

  } catch (error) {
    throw error;
  }
}

// 混合搜索：结合关键词和向量搜索
async function hybridSearch(query, userId, limit = 20) {
  try {
    const queryEmbedding = await generateQueryEmbedding(query);

    // 并行执行两种搜索
    const [vectorResults] = await Promise.all([
      searchByEmbeddings(queryEmbedding, userId, limit * 2), // 获取更多结果用于重排序
    ]);

    // 关键词搜索（简单实现）
    const keywordResults = await keywordSearch(query, userId, limit * 2);

    // 合并和重排序结果
    const combinedResults = mergeAndRerank(vectorResults, keywordResults, limit);

    return combinedResults;

  } catch (error) {
    throw error;
  }
}

// 简单的关键词搜索
async function keywordSearch(query, userId, limit = 20) {
  try {
    const { data: bookmarks, error } = await supabase
      .from('bookmarks')
      .select('id, title, url, content')
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%,url.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(limit);

    if (error) {
      throw error;
    }

    // 为关键词搜索结果添加相似度分数
    return bookmarks.map(bookmark => ({
      ...bookmark,
      similarity: 0.8, // 关键词匹配给较高分数
      score: 0.8,
      matchType: 'keyword'
    }));

  } catch (error) {
    return [];
  }
}

// 合并和重排序结果
function mergeAndRerank(vectorResults, keywordResults, limit) {
  // 创建结果映射
  const resultMap = new Map();

  // 添加向量搜索结果
  vectorResults.forEach(result => {
    resultMap.set(result.id, {
      ...result,
      vectorScore: result.similarity,
      keywordScore: 0,
      matchType: 'vector'
    });
  });

  // 添加关键词搜索结果
  keywordResults.forEach(result => {
    if (resultMap.has(result.id)) {
      // 如果已经在向量结果中，更新关键词分数
      const existing = resultMap.get(result.id);
      existing.keywordScore = result.similarity;
      existing.matchType = 'hybrid';
    } else {
      // 如果不在向量结果中，添加新结果
      resultMap.set(result.id, {
        ...result,
        vectorScore: 0,
        keywordScore: result.similarity,
        matchType: 'keyword'
      });
    }
  });

  // 计算综合分数并排序
  const finalResults = Array.from(resultMap.values()).map(result => ({
    ...result,
    finalScore: (result.vectorScore * 0.7) + (result.keywordScore * 0.3), // 向量权重70%，关键词权重30%
    similarity: (result.vectorScore * 0.7) + (result.keywordScore * 0.3)
  }));

  // 按综合分数排序
  finalResults.sort((a, b) => b.finalScore - a.finalScore);

  return finalResults.slice(0, limit);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, userId, mode = 'hybrid', limit = 20 } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid search query' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }


    let results;

    switch (mode) {
      case 'vector':
        const queryEmbedding = await generateQueryEmbedding(query);
        results = await searchByEmbeddings(queryEmbedding, userId, limit);
        break;

      case 'keyword':
        results = await keywordSearch(query, userId, limit);
        break;

      case 'hybrid':
      default:
        results = await hybridSearch(query, userId, limit);
        break;
    }


    res.status(200).json({
      success: true,
      query,
      mode,
      results,
      total: results.length
    });

  } catch (error) {
    res.status(500).json({
      error: 'Search failed',
      details: error.message
    });
  }
}
