import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function processBookmarks(request, response) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  const { bookmarks } = request.body;

  if (!bookmarks || !Array.isArray(bookmarks)) {
    return response.status(400).json({ message: 'Invalid bookmarks data' });
  }

  console.log(`Received ${bookmarks.length} bookmarks to process.`);

  try {
    // For demonstration, we'll process only the first bookmark
    const firstBookmark = bookmarks[0];
    if (!firstBookmark || !firstBookmark.url) {
      return response.status(400).json({ message: 'No valid bookmark to process.' });
    }

    const fetchResponse = await fetch(firstBookmark.url);
    const html = await fetchResponse.text();
    const $ = cheerio.load(html);

    // A simple logic to extract text from the body, removing script and style tags
    $('script, style').remove();
    const textContent = $('body').text().replace(/\s\s+/g, ' ').trim();

    console.log(`Extracted text from ${firstBookmark.url}:`, textContent.substring(0, 500));

    const categories = ['技术文档', '新闻文章', '设计灵感', '生活方式', '娱乐', '其他'];
    const prompt = `You are an expert at categorizing bookmarks. Please categorize the following text into one of the given categories. Respond with only the category name. Categories: [${categories.join(', ')}]\n\nText: '${textContent.substring(0, 4000)}'\nCategory:`;

    const result = await model.generateContent(prompt);
    const geminiResponse = await result.response;
    let category = geminiResponse.text().trim();

    if (!categories.includes(category)) {
      category = '其他'; // Fallback to 'Other' if the response is not a valid category
    }
    console.log(`Gemini Category:`, category);

    response.status(200).json({ 
      message: `Successfully processed ${firstBookmark.url}.`,
      category: category
    });

  } catch (error) {
    console.error('Error processing bookmark:', error);
    response.status(500).json({ message: 'Failed to process bookmark.' });
  }
}
