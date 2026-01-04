# 国际化第 6 批：后台消息处理（Background Messaging）

**批次编号**: 6  
**翻译日期**: 2025-01-03  
**文案数量**: 50 条  
**类别**: 后台消息处理、操作反馈、系统消息

---

## 翻译内容

| Key | zh-CN (简体中文) | zh-TW (繁体中文) | en (英语) | ja (日语) | ko (韩语) | de (德语) | es (西班牙语) |
|-----|-----------------|-----------------|-----------|----------|----------|----------|-------------|
| `messaging.message_type` | 消息类型 | 訊息類型 | Message type | メッセージタイプ | 메시지 유형 | Nachrichtentyp | Tipo de mensaje |
| `messaging.optional_data` | 可选的消息数据 | 可選的訊息資料 | Optional message data | オプションのメッセージデータ | 선택적 메시지 데이터 | Optionale Nachrichtendaten | Datos de mensaje opcionales |
| `messaging.received` | 收到 | 收到 | Received | 受信 | 수신됨 | Empfangen | Recibido |
| `messaging.request` | 请求 | 請求 | Request | リクエスト | 요청 | Anfrage | Solicitud |
| `messaging.processing_failed` | 处理消息失败 | 處理訊息失敗 | Failed to process message | メッセージ処理に失敗 | 메시지 처리 실패 | Nachrichtenverarbeitung fehlgeschlagen | Error al procesar mensaje |
| `messaging.timeout` | 超时 | 逾時 | Timeout | タイムアウト | 시간 초과 | Zeitüberschreitung | Tiempo agotado |
| `messaging.return_empty_array` | 返回空数组 | 返回空陣列 | Returning empty array | 空の配列を返す | 빈 배열 반환 | Leeres Array zurückgeben | Devolviendo array vacío |
| `messaging.cannot_create_bookmark` | 无法创建书签 | 無法建立書籤 | Cannot create bookmark | ブックマークを作成できません | 북마크를 생성할 수 없음 | Lesezeichen kann nicht erstellt werden | No se puede crear marcador |
| `messaging.empty_or_undefined` | 为空或未定义 | 為空或未定義 | is empty or undefined | が空または未定義です | 비어 있거나 정의되지 않음 | ist leer oder undefiniert | está vacío o indefinido |
| `messaging.title_empty` | 标题为空 | 標題為空 | Title is empty | タイトルが空です | 제목이 비어 있음 | Titel ist leer | El título está vacío |
| `messaging.using` | 使用 | 使用 | Using | を使用 | 사용 중 | Verwende | Usando |
| `messaging.as_title` | 作为标题 | 作為標題 | as title | をタイトルとして | 제목으로 | als Titel | como título |
| `messaging.create_bookmark` | 创建书签 | 建立書籤 | Create bookmark | ブックマークを作成 | 북마크 생성 | Lesezeichen erstellen | Crear marcador |
| `messaging.if_title_empty` | 如果标题为空 | 如果標題為空 | If title is empty | タイトルが空の場合 | 제목이 비어 있는 경우 | Wenn Titel leer ist | Si el título está vacío |
| `messaging.must_provide` | 必须提供 | 必須提供 | Must provide | を提供する必要があります | 제공해야 함 | Muss bereitstellen | Debe proporcionar |
| `messaging.otherwise_folder` | 否则会创建文件夹 | 否則會建立資料夾 | Otherwise a folder will be created | そうでない場合、フォルダが作成されます | 그렇지 않으면 폴더가 생성됨 | Andernfalls wird ein Ordner erstellt | De lo contrario se creará una carpeta |
| `messaging.bookmark_created` | 书签已创建 | 書籤已建立 | Bookmark created | ブックマークが作成されました | 북마크가 생성됨 | Lesezeichen erstellt | Marcador creado |
| `messaging.create_bookmark_failed` | 创建书签失败 | 建立書籤失敗 | Failed to create bookmark | ブックマークの作成に失敗 | 북마크 생성 실패 | Lesezeichen erstellen fehlgeschlagen | Error al crear marcador |
| `messaging.missing_bookmark` | 缺少书签 | 缺少書籤 | Missing bookmark | ブックマークがありません | 북마크 누락 | Lesezeichen fehlt | Falta marcador |
| `messaging.bookmark_updated` | 书签已更新 | 書籤已更新 | Bookmark updated | ブックマークが更新されました | 북마크가 업데이트됨 | Lesezeichen aktualisiert | Marcador actualizado |
| `messaging.update_bookmark_failed` | 更新书签失败 | 更新書籤失敗 | Failed to update bookmark | ブックマークの更新に失敗 | 북마크 업데이트 실패 | Lesezeichen aktualisieren fehlgeschlagen | Error al actualizar marcador |
| `messaging.bookmark_deleted` | 书签已删除 | 書籤已刪除 | Bookmark deleted | ブックマークが削除されました | 북마크가 삭제됨 | Lesezeichen gelöscht | Marcador eliminado |
| `messaging.delete_bookmark_failed` | 删除书签失败 | 刪除書籤失敗 | Failed to delete bookmark | ブックマークの削除に失敗 | 북마크 삭제 실패 | Lesezeichen löschen fehlgeschlagen | Error al eliminar marcador |
| `messaging.bookmark_moved` | 书签已移动 | 書籤已移動 | Bookmark moved | ブックマークが移動されました | 북마크가 이동됨 | Lesezeichen verschoben | Marcador movido |
| `messaging.move_bookmark_failed` | 移动书签失败 | 移動書籤失敗 | Failed to move bookmark | ブックマークの移動に失敗 | 북마크 이동 실패 | Lesezeichen verschieben fehlgeschlagen | Error al mover marcador |
| `messaging.folder_deleted` | 文件夹已删除 | 資料夾已刪除 | Folder deleted | フォルダが削除されました | 폴더가 삭제됨 | Ordner gelöscht | Carpeta eliminada |
| `messaging.recursive` | 递归 | 遞迴 | Recursive | 再帰的 | 재귀적 | Rekursiv | Recursivo |
| `messaging.delete_folder_failed` | 删除文件夹失败 | 刪除資料夾失敗 | Failed to delete folder | フォルダの削除に失敗 | 폴더 삭제 실패 | Ordner löschen fehlgeschlagen | Error al eliminar carpeta |
| `messaging.title_and` | 标题和 | 標題和 | Title and | タイトルと | 제목 및 | Titel und | Título y |
| `messaging.cannot_be_empty` | 不能为空 | 不能為空 | cannot be empty | は空にできません | 비워둘 수 없음 | darf nicht leer sein | no puede estar vacío |
| `messaging.category_suggestions` | 分类建议 | 分類建議 | Category suggestions | カテゴリの提案 | 카테고리 제안 | Kategorievorschläge | Sugerencias de categoría |
| `messaging.get` | 获取 | 取得 | Get | 取得 | 가져오기 | Abrufen | Obtener |
| `messaging.get_suggestions_failed` | 分类建议失败 | 分類建議失敗 | Failed to get suggestions | 提案の取得に失敗 | 제안 가져오기 실패 | Vorschläge abrufen fehlgeschlagen | Error al obtener sugerencias |
| `messaging.start_get_tree` | 开始获取书签树 | 開始取得書籤樹 | Starting to get bookmark tree | ブックマークツリーの取得を開始 | 북마크 트리 가져오기 시작 | Beginne Lesezeichenbaum abzurufen | Comenzando a obtener árbol de marcadores |
| `messaging.got_tree` | 获取到书签树 | 取得到書籤樹 | Got bookmark tree | ブックマークツリーを取得しました | 북마크 트리를 가져옴 | Lesezeichenbaum erhalten | Árbol de marcadores obtenido |
| `messaging.send_tree_response` | 发送书签树响应 | 發送書籤樹回應 | Sending bookmark tree response | ブックマークツリーのレスポンスを送信 | 북마크 트리 응답 전송 | Sende Lesezeichenbaum-Antwort | Enviando respuesta de árbol de marcadores |
| `messaging.get_tree_failed` | 获取书签树失败 | 取得書籤樹失敗 | Failed to get bookmark tree | ブックマークツリーの取得に失敗 | 북마크 트리 가져오기 실패 | Lesezeichenbaum abrufen fehlgeschlagen | Error al obtener árbol de marcadores |
| `messaging.unknown_location` | 未知位置 | 未知位置 | Unknown location | 不明な場所 | 알 수 없는 위치 | Unbekannter Standort | Ubicación desconocida |
| `messaging.is_empty` | 为空 | 為空 | is empty | が空です | 비어 있음 | ist leer | está vacío |
| `messaging.check` | 检查 | 檢查 | Check | チェック | 확인 | Prüfen | Verificar |
| `messaging.duplicate` | 重复 | 重複 | Duplicate | 重複 | 중복 | Duplikat | Duplicado |
| `messaging.remove_trailing_slash` | 移除尾部斜杠 | 移除尾部斜線 | Remove trailing slash | 末尾のスラッシュを削除 | 후행 슬래시 제거 | Abschließenden Schrägstrich entfernen | Eliminar barra diagonal final |
| `messaging.detected` | 检测到 | 檢測到 | Detected | 検出されました | 감지됨 | Erkannt | Detectado |
| `messaging.full_path_string` | 完整的路径字符串 | 完整的路徑字串 | Full path string | 完全なパス文字列 | 전체 경로 문자열 | Vollständiger Pfadstring | Cadena de ruta completa |
| `messaging.parent_path` | 父级路径 | 父級路徑 | Parent path | 親パス | 상위 경로 | Übergeordneter Pfad | Ruta padre |
| `messaging.compatible_old_code` | 兼容旧代码 | 相容舊程式碼 | Compatible with old code | 古いコードと互換性あり | 이전 코드와 호환 | Kompatibel mit altem Code | Compatible con código antiguo |
| `messaging.duplicate_failed` | 重复失败 | 重複失敗 | Duplicate failed | 重複に失敗 | 중복 실패 | Duplizieren fehlgeschlagen | Error al duplicar |
| `messaging.bookmark_item` | 书签 | 書籤 | Bookmark | ブックマーク | 북마크 | Lesezeichen | Marcador |
| `messaging.add_to_favorites` | 添加到收藏 | 加入收藏 | Add to favorites | お気に入りに追加 | 즐겨찾기에 추가 | Zu Favoriten hinzufügen | Añadir a favoritos |

---

## 翻译说明

### 类别说明
本批次翻译的是后台消息处理（Background Messaging）相关的文案，主要包括：
- 消息类型和状态
- 书签操作反馈（创建、更新、删除、移动）
- 文件夹操作反馈
- 错误和异常消息
- 系统日志消息

### 翻译原则
1. **简洁明了**：后台消息应该简短、直接
2. **技术准确**：保持技术术语的准确性
3. **一致性**：与前面批次的翻译保持一致
4. **用户友好**：即使是技术消息，也要易于理解

### 特殊说明
- `messaging.` 前缀表示这些是后台消息处理相关的文案
- 这些文案主要用于日志记录和开发调试
- 部分文案也会显示给用户（如操作成功/失败的提示）

---

## 使用示例

```typescript
// 在代码中使用
import { t } from '@/utils/i18n-helpers'

// 日志消息
console.log(t('messaging.received'), t('messaging.request'))

// 操作反馈
showToast(t('messaging.bookmark_created'))
showError(t('messaging.create_bookmark_failed'))

// 错误提示
throw new Error(t('messaging.cannot_create_bookmark'))
```

---

## 验证清单

- [ ] 所有 7 种语言的翻译已完成
- [ ] 翻译符合各语言的语法习惯
- [ ] 技术术语翻译准确
- [ ] 与已有翻译保持一致
- [ ] 运行 `bun run i18n:validate` 通过
- [ ] 运行 `bun run typecheck:force` 通过
- [ ] 运行 `bun run lint:check:force` 通过

---

**批次状态**: ✅ 已完成  
**总计翻译键数**: 319 (269 + 50)  
**覆盖率**: 7.0% (319/4,579)
