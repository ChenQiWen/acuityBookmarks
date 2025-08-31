import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

export async function searchBookmarks(query, bookmarks) {
  const lowerCaseQuery = query.toLowerCase();
  const matchedBookmarks = [];

  for (const bookmark of bookmarks) {
    if (bookmark.url) {
      if (bookmark.title.toLowerCase().includes(lowerCaseQuery)) {
        matchedBookmarks.push(bookmark);
        continue;
      }

      try {
        const response = await fetch(bookmark.url);
        const html = await response.text();
        const $ = cheerio.load(html);
        const content = $('body').text().toLowerCase();

        if (content.includes(lowerCaseQuery)) {
          matchedBookmarks.push(bookmark);
        }
      } catch (error) {
        console.error(`Error fetching ${bookmark.url}:`, error);
      }
    }
  }

  return matchedBookmarks;
}
