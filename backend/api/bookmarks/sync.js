import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Vercel环境变量
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(geminiApiKey);

// 生成嵌入向量的工具函数
async function generateEmbedding(text) {
  try {
    const model = genAI.getGenerativeModel({ model: "embedding-001" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    throw new Error('Failed to generate embedding');
  }
}

// 提取内容用于嵌入
function extractContentForEmbedding(bookmark) {
  return `${bookmark.title} ${bookmark.url}`.substring(0, 1000);
}

// 增量同步书签
async function syncBookmarksIncremental(changes, userId) {
  const results = {
    added: 0,
    updated: 0,
    deleted: 0,
    errors: []
  };

  try {
    // 处理新增和更新的书签
    if (changes.added && changes.added.length > 0) {

      const bookmarksToAdd = [];
      const embeddingsToAdd = [];

      for (const bookmark of changes.added) {
        try {
          const content = extractContentForEmbedding(bookmark);
          const embedding = await generateEmbedding(content);

          bookmarksToAdd.push({
            id: bookmark.id,
            title: bookmark.title,
            url: bookmark.url,
            content: content,
            user_id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

          embeddingsToAdd.push({
            bookmark_id: bookmark.id,
            user_id: userId,
            embedding: embedding,
            created_at: new Date().toISOString()
          });

          results.added++;
        } catch (error) {
          results.errors.push({
            type: 'add',
            bookmarkId: bookmark.id,
            error: error.message
          });
        }
      }

      // 批量插入
      if (bookmarksToAdd.length > 0) {
        const { error: bookmarksError } = await supabase
          .from('bookmarks')
          .upsert(bookmarksToAdd, { onConflict: 'id,user_id' });

        if (bookmarksError) {
          throw bookmarksError;
        }

        const { error: embeddingsError } = await supabase
          .from('embeddings')
          .upsert(embeddingsToAdd, { onConflict: 'bookmark_id,user_id' });

        if (embeddingsError) {
          throw embeddingsError;
        }
      }
    }

    // 处理更新的书签
    if (changes.updated && changes.updated.length > 0) {

      for (const bookmark of changes.updated) {
        try {
          const content = extractContentForEmbedding(bookmark);
          const embedding = await generateEmbedding(content);

          // 更新书签
          const { error: updateError } = await supabase
            .from('bookmarks')
            .update({
              title: bookmark.title,
              url: bookmark.url,
              content: content,
              updated_at: new Date().toISOString()
            })
            .eq('id', bookmark.id)
            .eq('user_id', userId);

          if (updateError) {
            throw updateError;
          }

          // 更新嵌入向量
          const { error: embeddingError } = await supabase
            .from('embeddings')
            .update({
              embedding: embedding
            })
            .eq('bookmark_id', bookmark.id)
            .eq('user_id', userId);

          if (embeddingError) {
            throw embeddingError;
          }

          results.updated++;
        } catch (error) {
          results.errors.push({
            type: 'update',
            bookmarkId: bookmark.id,
            error: error.message
          });
        }
      }
    }

    // 处理删除的书签
    if (changes.deleted && changes.deleted.length > 0) {

      const bookmarkIds = changes.deleted.map(b => b.id);

      // 删除书签
      const { error: deleteBookmarksError } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', userId)
        .in('id', bookmarkIds);

      if (deleteBookmarksError) {
        throw deleteBookmarksError;
      }

      // 删除对应的嵌入向量
      const { error: deleteEmbeddingsError } = await supabase
        .from('embeddings')
        .delete()
        .eq('user_id', userId)
        .in('bookmark_id', bookmarkIds);

      if (deleteEmbeddingsError) {
        throw deleteEmbeddingsError;
      }

      results.deleted = bookmarkIds.length;
    }

  } catch (error) {
    throw error;
  }

  return results;
}

// 全量同步（用于初次同步或完全重建）
async function syncBookmarksFull(bookmarks, userId) {
  try {

    // 先删除用户的所有现有数据
    await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', userId);

    await supabase
      .from('embeddings')
      .delete()
      .eq('user_id', userId);

    // 重新上传所有数据
    const uploadResponse = await fetch(`${process.env.VERCEL_URL}/api/bookmarks/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bookmarks,
        userId
      })
    });

    if (!uploadResponse.ok) {
      throw new Error('Full sync upload failed');
    }

    const result = await uploadResponse.json();
    return result;

  } catch (error) {
    throw error;
  }
}

// 获取用户的书签状态
async function getUserBookmarkStats(userId) {
  try {
    const { data: bookmarks, error } = await supabase
      .from('bookmarks')
      .select('id, updated_at')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return {
      totalBookmarks: bookmarks.length,
      lastSync: bookmarks.length > 0 ?
        new Date(Math.max(...bookmarks.map(b => new Date(b.updated_at).getTime()))) :
        null,
      bookmarkIds: bookmarks.map(b => b.id)
    };

  } catch (error) {
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { changes, bookmarks, userId, syncType = 'incremental' } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }


    let result;

    if (syncType === 'full' && bookmarks) {
      // 全量同步
      result = await syncBookmarksFull(bookmarks, userId);
    } else if (syncType === 'incremental' && changes) {
      // 增量同步
      result = await syncBookmarksIncremental(changes, userId);
    } else if (syncType === 'stats') {
      // 获取状态
      result = await getUserBookmarkStats(userId);
    } else {
      return res.status(400).json({ error: 'Invalid sync type or missing data' });
    }


    res.status(200).json({
      success: true,
      syncType,
      userId,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Sync failed',
      details: error.message
    });
  }
}
