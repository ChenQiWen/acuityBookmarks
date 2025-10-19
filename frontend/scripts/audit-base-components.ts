#!/usr/bin/env bun

/**
 * 基础组件健康检查脚本
 *
 * 作用：扫描 `src/components/base`，统计每个组件是否存在 README、类型声明、Story、测试文件。
 * 输出：Markdown 表格，供文档同步使用。
 */

import { readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

interface ComponentStatus {
  name: string
  hasReadme: boolean
  hasType: boolean
  hasStory: boolean
  hasTest: boolean
}

const BASE_DIR = join(process.cwd(), 'src/components/base')

async function listDirs(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true })
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name)
}

function resolveStatus(component: string): ComponentStatus {
  const dir = join(BASE_DIR, component)
  const hasReadme = existsSync(join(dir, 'README.md'))
  const hasType = existsSync(join(dir, `${component}.d.ts`))
  const hasStory =
    existsSync(join(dir, `${component}.stories.ts`)) ||
    existsSync(join(dir, `${component}.stories.tsx`))
  const hasTest =
    existsSync(join(dir, `${component}.spec.ts`)) ||
    existsSync(join(dir, `${component}.test.ts`))

  return { name: component, hasReadme, hasType, hasStory, hasTest }
}

function formatMarkdown(statusList: ComponentStatus[]): string {
  const header = ['组件', 'README', '类型声明', 'Story', '单测']
  const rows = statusList.map(status => [
    status.name,
    status.hasReadme ? '✅' : '❌',
    status.hasType ? '✅' : '❌',
    status.hasStory ? '✅' : '❌',
    status.hasTest ? '✅' : '❌'
  ])

  const table = [header, ['---', '---', '---', '---', '---'], ...rows]
    .map(cols => `| ${cols.join(' | ')} |`)
    .join('\n')

  const summary = `
共扫描组件：${statusList.length} 个。
Story 缺失：${statusList.filter(item => !item.hasStory).length} 个；单测缺失：${statusList.filter(item => !item.hasTest).length} 个。
`

  return `${table}\n${summary}`
}

async function main(): Promise<void> {
  const dirs = await listDirs(BASE_DIR)
  const statusList = dirs.map(resolveStatus)
  const markdown = formatMarkdown(statusList)
  process.stdout.write(markdown)
}

void main()
