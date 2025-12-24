// @ts-ignore - ali-oss 没有类型定义
import OSS from 'ali-oss'
// @ts-ignore - spark-md5 没有类型定义
import SparkMD5 from 'spark-md5'
import { checkFileAndGetUploadInfo, insertFile } from '@/api'
import type { FileInterface } from '@/types/api'

/**
 * 计算文件的 MD5 值
 * 使用分块读取方式，类似后端实现
 */
export async function calculateFileMD5(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer()
    const fileReader = new FileReader()
    // 兼容不同浏览器的 slice 方法
    // biome-ignore lint/suspicious/noExplicitAny: 需要兼容不同浏览器的 slice 方法
    const blobSlice = (File.prototype as any).slice || (File.prototype as any).mozSlice || (File.prototype as any).webkitSlice
    const chunkSize = 2097152 // 2MB chunks
    const chunks = Math.ceil(file.size / chunkSize)
    let currentChunk = 0

    fileReader.onload = (e) => {
      const chunk = e.target?.result as ArrayBuffer
      spark.append(chunk)
      currentChunk++

      if (currentChunk < chunks) {
        loadNext()
      } else {
        resolve(spark.end())
      }
    }

    fileReader.onerror = (err) => {
      reject(err)
    }

    function loadNext() {
      const start = currentChunk * chunkSize
      const end = start + chunkSize >= file.size ? file.size : start + chunkSize
      fileReader.readAsArrayBuffer(blobSlice.call(file, start, end))
    }

    loadNext()
  })
}

/**
 * 获取文件扩展名
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot !== -1 ? filename.substring(lastDot) : ''
}
export async function uploadImageOSS(file: { file?: File; url: string; }): Promise<string> {
  let url: string
  if (file.file) {
    const res = await uploadFileToOSS(file.file)
    url = res.file_url
  } else {
    url = file.url.replace(BASE_IMG, '')
  }
  return url
}
/**
 * 上传文件到 OSS（前端直传）
 * @param file 要上传的文件
 * @param path 可选的自定义路径，默认为 'editor'
 * @returns 返回文件信息，包含 file_url
 */
export async function uploadFileToOSS(
  file: File,
  path = 'editor'
): Promise<FileInterface> {
  try {
    // 1. 计算文件 MD5
    const fileMD5 = await calculateFileMD5(file)
    
    // 2. 检查文件是否存在
    const checkResult = await checkFileAndGetUploadInfo({
      file_md5: fileMD5,
      path
    })
    
    // 3. 如果文件已存在，直接返回
    if (checkResult.exists && checkResult.file_url && checkResult.file_id) {
      return {
        file_id: checkResult.file_id,
        file_url: checkResult.file_url,
        file_type: 0, // 默认类型，可根据需要调整
        file_md5: fileMD5,
        create_time: new Date()
      }
    }
    
    // 4. 文件不存在，获取 OSS 签名并上传
    if (!checkResult.oss) {
      throw new Error('获取 OSS 签名失败')
    }
    
    const ossInfo = checkResult.oss
    const fileExtension = getFileExtension(file.name)
    const objectName = `${ossInfo.path}/${fileMD5}${fileExtension}`
    
    // 5. 初始化 OSS 客户端
    const client = new OSS({
      region: ossInfo.region,
      accessKeyId: ossInfo.AccessKeyId,
      accessKeySecret: ossInfo.AccessKeySecret,
      stsToken: ossInfo.SecurityToken,
      bucket: ossInfo.bucket
    })
    
    // 6. 上传文件到 OSS
    const uploadResult = await client.put(objectName, file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream'
      }
    })
    console.log('上传结果', uploadResult)
    // 7. 构建文件 URL
    // OSS 返回的 URL 格式通常是: https://bucket.region.aliyuncs.com/path/file
    // 需要提取路径部分，格式: path/file
    const fileUrl = uploadResult.name
    // 移除协议和域名部分
    // const urlMatch = fileUrl.match(/https?:\/\/[^/]+(.+)/)
    // if (urlMatch?.[1]) {
    //   fileUrl = urlMatch[1].startsWith('/') ? urlMatch[1].substring(1) : urlMatch[1]
    // } else {
    //   // 如果匹配失败，尝试直接使用 objectName
    //   fileUrl = objectName
    // }
    
    // 8. 调用 insertFile 接口保存文件记录
    const fileRecord = await insertFile({
      file_url: fileUrl,
      file_md5: fileMD5,
      file_type: 0, // 默认类型，可根据需要调整
      file_size: file.size // 文件大小（字节）
    })
    
    return fileRecord
  } catch (error) {
    console.error('上传文件到 OSS 失败:', error)
    throw error
  }
}

