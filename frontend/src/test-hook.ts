// 测试文件：包含 TypeScript 错误
export function testFunction() {
  const x: string = 123 // ❌ 类型错误
  return x
}
