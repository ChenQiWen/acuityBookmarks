// Dedicated Web Worker for hybrid search result merging and ranking
// Inputs: keywordResults (SearchResult[]), semanticResults ({id, score}[]), weights, minCombinedScore

type KeywordBookmark = {
  id: string
  title?: string
  url?: string
  domain?: string
}

type KeywordResult = {
  bookmark: KeywordBookmark
  score: number
}

type SemanticResult = {
  id: string
  title?: string
  url?: string
  domain?: string
  score: number
}

interface HybridWorkerRequest {
  keywordResults: KeywordResult[]
  semanticResults: SemanticResult[]
  weights?: { keyword: number; semantic: number }
  minCombinedScore?: number
}

interface HybridWorkerResponse {
  results: Array<{
    id: string
    title?: string
    url?: string
    domain?: string
    score: number
  }>
  stats: {
    keywordCount: number
    semanticCount: number
    combinedCount: number
    maxKeywordScore: number
  }
}

function mergeAndRank(data: HybridWorkerRequest): HybridWorkerResponse {
  const { keywordResults, semanticResults } = data
  const weights = data.weights || { keyword: 0.4, semantic: 0.6 }
  const minCombinedScore =
    typeof data.minCombinedScore === 'number' ? data.minCombinedScore : 0

  const semMap = new Map<string, SemanticResult>()
  for (const s of semanticResults || []) {
    semMap.set(s.id, s)
  }

  let maxKw = 1
  for (const k of keywordResults || []) {
    if ((k.score || 0) > maxKw) maxKw = k.score || 1
  }

  const idSet = new Set<string>()
  for (const k of keywordResults || []) idSet.add(k.bookmark.id)
  for (const s of semanticResults || []) idSet.add(s.id)

  const merged: Array<{
    id: string
    title?: string
    url?: string
    domain?: string
    score: number
  }> = []

  idSet.forEach(id => {
    const kwItem = (keywordResults || []).find(r => r.bookmark.id === id)
    const semItem = semMap.get(id)

    const kwScoreNorm = kwItem ? (kwItem.score || 0) / (maxKw || 1) : 0
    const semScore = semItem ? semItem.score || 0 : 0
    const combined = weights.keyword * kwScoreNorm + weights.semantic * semScore

    if (combined >= minCombinedScore) {
      merged.push({
        id,
        title: kwItem?.bookmark.title ?? semItem?.title,
        url: kwItem?.bookmark.url ?? semItem?.url,
        domain: kwItem?.bookmark.domain ?? semItem?.domain,
        score: combined
      })
    }
  })

  merged.sort((a, b) => b.score - a.score)

  return {
    results: merged,
    stats: {
      keywordCount: keywordResults?.length || 0,
      semanticCount: semanticResults?.length || 0,
      combinedCount: merged.length,
      maxKeywordScore: maxKw
    }
  }
}

self.onmessage = (evt: MessageEvent) => {
  try {
    const req = evt.data as HybridWorkerRequest
    const resp = mergeAndRank(req)
    ;(self as any).postMessage(resp)
  } catch (error) {
    ;(self as any).postMessage({
      results: [],
      stats: {
        keywordCount: 0,
        semanticCount: 0,
        combinedCount: 0,
        maxKeywordScore: 1
      },
      error: String(error)
    })
  }
}
