/**
 * 私人书架：从手机里选一本电子书（EPUB / TXT / 文字版 PDF）上传。
 * 书只有本人能读，不进公共书库；可以给同一本书再上传其它语言版本。
 */
import { uploadPrivateBook, type PrivateBook } from './api';

const MAX_BYTES = 20 * 1024 * 1024;
const TYPES = ['application/epub+zip', 'text/plain', 'application/pdf'];

export class PickCancelled extends Error {}

/** 选文件并上传；用户取消抛 PickCancelled，其它失败抛带原因的 Error。 */
export async function pickAndUploadBook(userId: string, bookId?: string): Promise<PrivateBook> {
  // 原生模块按需加载（旧构建没有时给出明确提示）
  let DocumentPicker: typeof import('expo-document-picker');
  let FileSystem: typeof import('expo-file-system/legacy');
  try {
    DocumentPicker = require('expo-document-picker');
    FileSystem = require('expo-file-system/legacy');
  } catch {
    throw new Error('needUpdate');
  }
  const res = await DocumentPicker.getDocumentAsync({ type: TYPES, copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) throw new PickCancelled();
  const a = res.assets[0];
  if (a.size && a.size > MAX_BYTES) throw new Error('tooBig');
  const base64 = await FileSystem.readAsStringAsync(a.uri, { encoding: FileSystem.EncodingType.Base64 });
  return uploadPrivateBook({ userId, filename: a.name || 'book', base64, bookId });
}

/** 上传失败的提示文案：已知原因走 i18n，服务器给的原因原样显示 */
export function uploadErrorText(err: unknown, t: (key: string) => string): string {
  const msg = err instanceof Error ? err.message : '';
  const key = `shelf.err.${msg}`;
  const known = t(key);
  return known !== key ? known : msg || t('shelf.err.unknown');
}
