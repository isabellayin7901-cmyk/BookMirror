// 推送通知：注册 Expo push token + 处理点击跳转。
// 用 lazy require，老构建（OTA 拿不到原生模块）不会崩溃，只是静默跳过。
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { storage } from './storage';
import { registerPushToken } from './api';
import { navigate } from './navigationRef';

let configured = false;

export async function setupPush(): Promise<void> {
  let Notifications: typeof import('expo-notifications');
  let Device: typeof import('expo-device');
  try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');
  } catch {
    return; // 旧构建无原生模块，跳过
  }

  try {
    if (!configured) {
      configured = true;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      // 点通知 → 进对应聊天
      Notifications.addNotificationResponseReceivedListener((resp) => {
        const data = (resp.notification.request.content.data || {}) as { type?: string; peerId?: string };
        if (data.type === 'dm' && data.peerId) {
          navigate('DMChat', { peerId: data.peerId });
        }
      });
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
    }

    if (!Device.isDevice) return; // 模拟器拿不到真实 token
    const perm = await Notifications.getPermissionsAsync();
    let granted = perm.granted;
    if (!granted) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenResp.data;
    const uid = await storage.getUserId();
    if (uid && token) await registerPushToken(uid, token, Platform.OS);
  } catch {
    /* best-effort：失败不影响 App */
  }
}
