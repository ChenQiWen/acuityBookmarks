/**
 * Microsoft Graph API 服务
 * 
 * 职责：
 * - 调用 Microsoft Graph API 获取用户信息
 * - 获取用户头像
 * - 处理 API 错误
 */

/**
 * 获取 Microsoft 用户头像
 * 
 * @param accessToken - Microsoft OAuth access token
 * @returns 头像 URL（Base64 Data URL）或 null
 */
export async function getMicrosoftUserPhoto(
  accessToken: string
): Promise<string | null> {
  try {
    console.log('[Microsoft Graph] 🖼️ 开始获取用户头像...')

    // 调用 Microsoft Graph API 获取用户头像
    // https://learn.microsoft.com/en-us/graph/api/profilephoto-get
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/photo/$value',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[Microsoft Graph] ⚠️ 用户未设置头像')
        return null
      }
      console.error('[Microsoft Graph] ❌ 获取头像失败:', response.status, response.statusText)
      return null
    }

    // 将图片转换为 Blob
    const blob = await response.blob()
    
    // 转换为 Base64 Data URL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    console.log('[Microsoft Graph] ✅ 头像获取成功')
    return dataUrl
  } catch (error) {
    console.error('[Microsoft Graph] ❌ 获取头像异常:', error)
    return null
  }
}

/**
 * 获取 Microsoft 用户基本信息
 * 
 * @param accessToken - Microsoft OAuth access token
 * @returns 用户信息或 null
 */
export async function getMicrosoftUserInfo(
  accessToken: string
): Promise<{
  displayName?: string
  givenName?: string
  surname?: string
  mail?: string
  userPrincipalName?: string
} | null> {
  try {
    console.log('[Microsoft Graph] 👤 开始获取用户信息...')

    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      console.error('[Microsoft Graph] ❌ 获取用户信息失败:', response.status, response.statusText)
      return null
    }

    const userInfo = await response.json()
    console.log('[Microsoft Graph] ✅ 用户信息获取成功:', userInfo)
    return userInfo
  } catch (error) {
    console.error('[Microsoft Graph] ❌ 获取用户信息异常:', error)
    return null
  }
}
