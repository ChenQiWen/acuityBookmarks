/**
 * 搜索结果高亮
 *
 * 功能：
 * - 关键词匹配和高亮
 * - 支持模糊匹配
 * - 多关键词高亮
 * - HTML 安全
 */

import type { HighlightSegment } from './unified-search-types'

export class HighlightEngine {
  /**
   * 高亮文本中的关键词
   */
  highlight(text: string, query: string): HighlightSegment[] {
    if (!text || !query) {
      return [{ text, isMatch: false, start: 0, end: text.length }]
    }

    const segments: HighlightSegment[] = []
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()

    // 分割查询词
    const queryTerms = this.tokenize(lowerQuery)

    // 查找所有匹配位置
    const matches = this.findMatches(lowerText, queryTerms)

    // 合并重叠的匹配
    const mergedMatches = this.mergeOverlaps(matches)

    // 生成高亮段落
    let lastEnd = 0
    for (const match of mergedMatches) {
      // 添加未匹配的部分
      if (match.start > lastEnd) {
        segments.push({
          text: text.substring(lastEnd, match.start),
          isMatch: false,
          start: lastEnd,
          end: match.start
        })
      }

      // 添加匹配的部分
      segments.push({
        text: text.substring(match.start, match.end),
        isMatch: true,
        start: match.start,
        end: match.end
      })

      lastEnd = match.end
    }

    // 添加剩余部分
    if (lastEnd < text.length) {
      segments.push({
        text: text.substring(lastEnd),
        isMatch: false,
        start: lastEnd,
        end: text.length
      })
    }

    return segments.length > 0
      ? segments
      : [{ text, isMatch: false, start: 0, end: text.length }]
  }

  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    // 按空格、标点符号等分割
    return text
      .split(/[\s\-_./\\,;:!?]+/)
      .filter(term => term.length > 0)
      .map(term => term.trim())
  }

  /**
   * 查找所有匹配位置
   */
  private findMatches(
    text: string,
    queryTerms: string[]
  ): Array<{ start: number; end: number }> {
    const matches: Array<{ start: number; end: number }> = []

    for (const term of queryTerms) {
      if (!term) continue

      // 精确匹配
      let index = 0
      while ((index = text.indexOf(term, index)) !== -1) {
        matches.push({
          start: index,
          end: index + term.length
        })
        index += term.length
      }

      // 模糊匹配（如果精确匹配失败）
      if (matches.length === 0 && term.length > 3) {
        const fuzzyMatches = this.fuzzyMatch(text, term)
        matches.push(...fuzzyMatches)
      }
    }

    return matches.sort((a, b) => a.start - b.start)
  }

  /**
   * 模糊匹配
   */
  private fuzzyMatch(
    text: string,
    pattern: string,
    maxDistance: number = 2
  ): Array<{ start: number; end: number }> {
    const matches: Array<{ start: number; end: number }> = []
    const windowSize = pattern.length + maxDistance

    for (let i = 0; i <= text.length - pattern.length; i++) {
      const window = text.substring(i, Math.min(i + windowSize, text.length))
      const distance = this.levenshteinDistance(
        pattern,
        window.substring(0, pattern.length)
      )

      if (distance <= maxDistance) {
        matches.push({
          start: i,
          end: i + pattern.length
        })
      }
    }

    return matches
  }

  /**
   * 计算编辑距离
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[b.length][a.length]
  }

  /**
   * 合并重叠的匹配
   */
  private mergeOverlaps(
    matches: Array<{ start: number; end: number }>
  ): Array<{ start: number; end: number }> {
    if (matches.length === 0) return []

    const merged: Array<{ start: number; end: number }> = []
    let current = matches[0]

    for (let i = 1; i < matches.length; i++) {
      const next = matches[i]

      if (next.start <= current.end) {
        // 合并重叠或相邻的匹配
        current = {
          start: current.start,
          end: Math.max(current.end, next.end)
        }
      } else {
        merged.push(current)
        current = next
      }
    }

    merged.push(current)
    return merged
  }

  /**
   * 转换为 HTML
   */
  toHTML(segments: HighlightSegment[], tag: string = 'mark'): string {
    return segments
      .map(segment => {
        const escaped = this.escapeHTML(segment.text)
        return segment.isMatch ? `<${tag}>${escaped}</${tag}>` : escaped
      })
      .join('')
  }

  /**
   * HTML 转义
   */
  private escapeHTML(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * 获取上下文片段
   */
  getContextSnippet(
    text: string,
    query: string,
    maxLength: number = 100
  ): { snippet: string; highlights: HighlightSegment[] } {
    const segments = this.highlight(text, query)

    // 找到第一个匹配
    const firstMatchIndex = segments.findIndex(s => s.isMatch)

    if (firstMatchIndex === -1) {
      // 没有匹配，返回开头
      const snippet = text.substring(0, maxLength)
      return {
        snippet,
        highlights: [
          { text: snippet, isMatch: false, start: 0, end: snippet.length }
        ]
      }
    }

    // 计算上下文范围
    const matchStart = segments[firstMatchIndex].start
    const contextStart = Math.max(0, matchStart - Math.floor(maxLength / 2))
    const contextEnd = Math.min(text.length, contextStart + maxLength)

    // 提取上下文
    const snippet = text.substring(contextStart, contextEnd)

    // 调整高亮段落到上下文范围
    const adjustedHighlights = segments
      .filter(s => s.end > contextStart && s.start < contextEnd)
      .map(s => ({
        text: text.substring(
          Math.max(s.start, contextStart),
          Math.min(s.end, contextEnd)
        ),
        isMatch: s.isMatch,
        start: Math.max(0, s.start - contextStart),
        end: Math.min(maxLength, s.end - contextStart)
      }))

    return {
      snippet:
        (contextStart > 0 ? '...' : '') +
        snippet +
        (contextEnd < text.length ? '...' : ''),
      highlights: adjustedHighlights
    }
  }
}
