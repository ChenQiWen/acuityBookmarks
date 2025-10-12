/**
 * 📝 Commitlint 配置
 * 验证Git提交消息格式，遵循 Conventional Commits 规范
 *
 * 支持的类型:
 * - feat: 新功能
 * - fix: 修复bug
 * - docs: 文档更新
 * - style: 代码格式（不影响代码运行的变动）
 * - refactor: 重构（既不是新功能，也不是修复bug）
 * - perf: 性能优化
 * - test: 测试相关
 * - build: 构建系统或外部依赖的更改
 * - ci: CI配置文件和脚本的变动
 * - chore: 其他不修改src或测试文件的更改
 * - revert: 回退之前的提交
 */

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 允许中文提交消息（不强制英文大小写）
    'subject-case': [0],

    // 提交类型必须是以下之一
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修复bug
        'docs', // 文档
        'style', // 格式
        'refactor', // 重构
        'perf', // 性能
        'test', // 测试
        'build', // 构建
        'ci', // CI
        'chore', // 其他
        'revert' // 回退
      ]
    ],

    // 主题不能为空
    'subject-empty': [2, 'never'],

    // 类型不能为空
    'type-empty': [2, 'never'],

    // 主题最大长度（中文按2个字符计算）
    'subject-max-length': [2, 'always', 100],

    // 正文每行最大长度
    'body-max-line-length': [2, 'always', 100],

    // 允许提交消息以句号结尾（中文习惯）
    'subject-full-stop': [0]
  }
}
