import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Vercel环境变量
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(geminiApiKey);

// 简单的文本嵌入函数（使用Gemini）
async function generateEmbedding(text) {
  try {
    // 使用Gemini的embedding模型
    const model = genAI.getGenerativeModel({ model: "embedding-001" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('Embedding generation failed:', error);
    throw new Error('Failed to generate embedding');
  }
}

// 提取网页内容用于嵌入
async function extractContentForEmbedding(bookmark) {
  try {
    // 这里可以调用爬虫来获取网页内容
    // 暂时使用标题和URL的组合作为嵌入文本
    const content = `${bookmark.title} ${bookmark.url}`;
    return content.substring(0, 1000); // 限制长度
  } catch (error) {
    console.error('Content extraction failed:', error);
    return `${bookmark.title} ${bookmark.url}`;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { bookmarks, userId } = req.body;

    if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
      return res.status(400).json({ error: 'Invalid bookmarks array' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`📤 Processing ${bookmarks.length} bookmarks for user ${userId}`);

    const processedBookmarks = [];
    const embeddings = [];

    // 分批处理以避免超时
    const batchSize = 10;
    for (let i = 0; i < bookmarks.length; i += batchSize) {
      const batch = bookmarks.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(bookmarks.length/batchSize)}`);

      for (const bookmark of batch) {
        try {
          // 提取内容用于嵌入
          const content = await extractContentForEmbedding(bookmark);

          // 生成嵌入向量
          const embedding = await generateEmbedding(content);

          // 准备数据
          const processedBookmark = {
            id: bookmark.id,
            title: bookmark.title,
            url: bookmark.url,
            content: content,
            user_id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          processedBookmarks.push(processedBookmark);
          embeddings.push({
            bookmark_id: bookmark.id,
            user_id: userId,
            embedding: embedding,
            created_at: new Date().toISOString()
          });

        } catch (error) {
          console.error(`❌ Failed to process bookmark ${bookmark.id}:`, error);
          // 继续处理其他书签
        }
      }

      // 每批处理完后短暂延迟，避免API限制
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 批量插入到数据库
    console.log(`💾 Saving ${processedBookmarks.length} bookmarks and ${embeddings.length} embeddings`);

    // 保存书签数据
    const { error: bookmarksError } = await supabase
      .from('bookmarks')
      .upsert(processedBookmarks, { onConflict: 'id,user_id' });

    if (bookmarksError) {
      console.error('Bookmarks insert error:', bookmarksError);
      throw bookmarksError;
    }

    // 保存嵌入向量
    const { error: embeddingsError } = await supabase
      .from('embeddings')
      .upsert(embeddings, { onConflict: 'bookmark_id,user_id' });

    if (embeddingsError) {
      console.error('Embeddings insert error:', embeddingsError);
      throw embeddingsError;
    }

    console.log('✅ Successfully processed and saved all bookmarks');

    res.status(200).json({
      success: true,
      message: `Processed ${processedBookmarks.length} bookmarks`,
      data: {
        bookmarksCount: processedBookmarks.length,
        embeddingsCount: embeddings.length
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Failed to process bookmarks',
      details: error.message
    });
  }
}
