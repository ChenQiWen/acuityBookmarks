/**
 * Bun原生性能基准测试
 * 对比关键操作的性能表现
 */

console.log('🚀 启动Bun原生性能基准测试');

// === 文件I/O性能测试 ===
async function benchmarkFileIO() {
  console.log('\n📁 文件I/O性能测试');
  
  const testData = {
    bookmarks: Array.from({ length: 1000 }, (_, i) => ({
      id: `bookmark_${i}`,
      title: `Test Bookmark ${i}`,
      url: `https://example${i}.com`,
      category: 'Test',
      tags: [`tag${i}`, `category${i % 10}`]
    }))
  };
  
  const filePath = './test-data.json';
  const iterations = 100;
  
  console.log(`测试数据: ${testData.bookmarks.length} 个书签`);
  console.log(`迭代次数: ${iterations}`);
  
  // Bun原生写入测试
  const writeStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    await Bun.write(filePath, JSON.stringify(testData));
  }
  const writeTime = performance.now() - writeStart;
  
  // Bun原生读取测试
  const readStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const file = Bun.file(filePath);
    await file.json();
  }
  const readTime = performance.now() - readStart;
  
  console.log(`✅ 写入性能: ${(writeTime / iterations).toFixed(2)}ms/次`);
  console.log(`✅ 读取性能: ${(readTime / iterations).toFixed(2)}ms/次`);
  
  // 清理测试文件
  try {
    await Bun.write(filePath, ''); // 清空文件
  } catch {}
}

// === HTTP请求性能测试 ===
async function benchmarkHTTPRequests() {
  console.log('\n🌐 HTTP请求性能测试');
  
  const urls = [
    'https://httpbin.org/status/200',
    'https://httpbin.org/json',
    'https://httpbin.org/headers'
  ];
  
  const iterations = 50;
  
  console.log(`测试URL数量: ${urls.length}`);
  console.log(`每个URL测试次数: ${iterations}`);
  
  for (const url of urls) {
    const start = performance.now();
    let successCount = 0;
    
    for (let i = 0; i < iterations; i++) {
      try {
        const response = await fetch(url, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) successCount++;
      } catch (error) {
        // 忽略网络错误
      }
    }
    
    const avgTime = (performance.now() - start) / iterations;
    console.log(`✅ ${url}: ${avgTime.toFixed(2)}ms/次 (成功率: ${(successCount/iterations*100).toFixed(1)}%)`);
  }
}

// === 并发处理性能测试 ===
async function benchmarkConcurrency() {
  console.log('\n⚡ 并发处理性能测试');
  
  const concurrencyLevels = [10, 50, 100, 200];
  
  for (const level of concurrencyLevels) {
    const start = performance.now();
    
    // 并发执行异步任务
    const promises = Array.from({ length: level }, async (_, i) => {
      // 模拟书签分类处理
      const bookmark = {
        title: `Test Bookmark ${i}`,
        url: `https://example${i}.com`
      };
      
      // 模拟AI分类逻辑
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      
      return {
        ...bookmark,
        category: 'Test',
        confidence: 0.85,
        processingTime: Math.random() * 100
      };
    });
    
    const results = await Promise.all(promises);
    const totalTime = performance.now() - start;
    const throughput = level / (totalTime / 1000);
    
    console.log(`✅ 并发级别 ${level}: ${totalTime.toFixed(2)}ms (吞吐量: ${throughput.toFixed(0)} tasks/s)`);
  }
}

// === JSON处理性能测试 ===
async function benchmarkJSONProcessing() {
  console.log('\n📊 JSON处理性能测试');
  
  const largeData = {
    bookmarks: Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      title: `Bookmark ${i}`.repeat(10),
      url: `https://example${i}.com/path/to/resource?param=${i}`,
      tags: [`tag${i}`, `category${i % 100}`, `type${i % 50}`],
      metadata: {
        created: new Date().toISOString(),
        visits: Math.floor(Math.random() * 1000),
        rating: Math.random() * 5
      }
    }))
  };
  
  const iterations = 100;
  
  // 序列化测试
  const serializeStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    JSON.stringify(largeData);
  }
  const serializeTime = performance.now() - serializeStart;
  
  // 反序列化测试
  const jsonString = JSON.stringify(largeData);
  const parseStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    JSON.parse(jsonString);
  }
  const parseTime = performance.now() - parseStart;
  
  console.log(`数据大小: ${(jsonString.length / 1024 / 1024).toFixed(2)}MB`);
  console.log(`✅ 序列化: ${(serializeTime / iterations).toFixed(2)}ms/次`);
  console.log(`✅ 反序列化: ${(parseTime / iterations).toFixed(2)}ms/次`);
}

// === 内存使用测试 ===
function benchmarkMemoryUsage() {
  console.log('\n💾 内存使用测试');
  
  const initial = process.memoryUsage();
  console.log('初始内存使用:');
  console.log(`  RSS: ${(initial.rss / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  Heap Used: ${(initial.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  Heap Total: ${(initial.heapTotal / 1024 / 1024).toFixed(2)}MB`);
  
  // 创建大量数据
  const data = Array.from({ length: 100000 }, (_, i) => ({
    id: i,
    data: `data_${i}`.repeat(100)
  }));
  
  const afterCreation = process.memoryUsage();
  console.log('\n创建大数据集后:');
  console.log(`  RSS: ${(afterCreation.rss / 1024 / 1024).toFixed(2)}MB (+${((afterCreation.rss - initial.rss) / 1024 / 1024).toFixed(2)}MB)`);
  console.log(`  Heap Used: ${(afterCreation.heapUsed / 1024 / 1024).toFixed(2)}MB (+${((afterCreation.heapUsed - initial.heapUsed) / 1024 / 1024).toFixed(2)}MB)`);
  
  // 清理数据
  data.length = 0;
  
  // 强制垃圾回收 (如果可用)
  if (global.gc) {
    global.gc();
  }
  
  setTimeout(() => {
    const afterCleanup = process.memoryUsage();
    console.log('\n清理后:');
    console.log(`  RSS: ${(afterCleanup.rss / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Heap Used: ${(afterCleanup.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }, 1000);
}

// === 运行所有基准测试 ===
async function runBenchmarks() {
  const startTime = performance.now();
  
  console.log('🔥 Bun Native Performance Benchmark');
  console.log('====================================');
  console.log(`运行时: ${process.versions?.bun ? 'Bun ' + process.versions.bun : 'Unknown'}`);
  console.log(`平台: ${process.platform} ${process.arch}`);
  console.log(`启动时间: ${new Date().toISOString()}`);
  
  try {
    await benchmarkFileIO();
    await benchmarkHTTPRequests();
    await benchmarkConcurrency();
    await benchmarkJSONProcessing();
    benchmarkMemoryUsage();
    
    const totalTime = performance.now() - startTime;
    console.log('\n🎯 基准测试完成');
    console.log(`总耗时: ${totalTime.toFixed(2)}ms`);
    console.log('====================================');
    
  } catch (error) {
    console.error('❌ 基准测试失败:', error);
  }
}

// 启动基准测试
runBenchmarks().catch(console.error);
