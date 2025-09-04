// 测试书签结构构建功能

// 模拟Chrome书签树结构
const mockChromeBookmarks = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: '书签栏',
        children: [
          {
            id: '10',
            title: 'Google',
            url: 'https://google.com'
          },
          {
            id: '11',
            title: 'GitHub',
            url: 'https://github.com'
          },
          {
            id: '12',
            title: 'Development',
            children: [
              {
                id: '120',
                title: 'MDN',
                url: 'https://developer.mozilla.org'
              },
              {
                id: '121',
                title: 'Stack Overflow',
                url: 'https://stackoverflow.com'
              }
            ]
          }
        ]
      },
      {
        id: '2',
        title: '其他书签',
        children: [
          {
            id: '20',
            title: 'YouTube',
            url: 'https://youtube.com'
          }
        ]
      }
    ]
  }
];

// 模拟flattenBookmarksTree函数
function flattenBookmarksTree(node, result = [], parentId = null) {
  if (node.children) {
    for (const child of node.children) {
      if (child.url) {
        // 这是书签
        result.push({
          id: child.id,
          title: child.title,
          url: child.url,
          parentId: parentId,
          type: 'bookmark',
          searchTerms: []
        });
      } else if (child.children) {
        // 这是文件夹
        result.push({
          id: child.id,
          title: child.title,
          parentId: parentId,
          type: 'folder',
          searchTerms: []
        });
        // 继续递归处理子节点
        flattenBookmarksTree(child, result, child.id);
      }
    }
  }
  return result;
}

// 模拟buildTreeFromBookmarks函数
function buildTreeFromBookmarks(bookmarks) {

  // 创建节点映射
  const nodeMap = new Map();
  const root = { id: '0', title: '', children: [] };

  // 首先创建所有节点
  bookmarks.forEach(bookmark => {
    const node = {
      id: bookmark.id,
      title: bookmark.title,
      parentId: bookmark.parentId
    };

    // 只有文件夹节点才有children属性
    if (bookmark.type === 'folder') {
      node.children = [];
    } else if (bookmark.type === 'bookmark') {
      node.url = bookmark.url;
    }

    nodeMap.set(bookmark.id, node);
  });

  // 构建树结构
  bookmarks.forEach(bookmark => {
    const node = nodeMap.get(bookmark.id);

    if (bookmark.parentId && bookmark.parentId !== '0') {
      const parent = nodeMap.get(bookmark.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // 父节点不存在，添加到根节点
        root.children.push(node);
      }
    } else {
      // 根级书签
      root.children.push(node);
    }
  });

  // 对文件夹进行排序（文件夹排在前面，书签排在后面）
  function sortChildren(node) {
    if (node.children && node.children.length > 0) {
      node.children.sort((a, b) => {
        // 文件夹（有children属性）排在前面
        if (a.children && !b.children) return -1;
        if (!a.children && b.children) return 1;
        // 同类型按标题排序
        return a.title.localeCompare(b.title);
      });

      // 递归排序子节点
      node.children.forEach(child => {
        if (child.children) {
          sortChildren(child);
        }
      });
    }
  }

  root.children.forEach(sortChildren);

  return [root];
}

// 测试函数
async function testBookmarkStructure() {
  const flattened = flattenBookmarksTree(mockChromeBookmarks[0]);
  flattened.forEach(item => {
  });

  const treeData = buildTreeFromBookmarks(flattened);

  const root = treeData[0];

  // 检查书签栏
  const bookmarksBar = root.children.find(c => c.title === '书签栏');

  // 检查Development文件夹
  const devFolder = bookmarksBar?.children?.find(c => c.title === 'Development');

  // 检查书签
  const googleBookmark = bookmarksBar?.children?.find(c => c.title === 'Google');

}

// 运行测试
testBookmarkStructure().catch(() => {});
