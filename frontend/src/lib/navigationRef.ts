import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../types';

/** 全局导航引用：让导航树之外的组件（如全局横幅）也能导航/读取当前路由。 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate<T extends keyof RootStackParamList>(
  name: T,
  params?: RootStackParamList[T],
) {
  if (navigationRef.isReady()) {
    (navigationRef.navigate as (n: string, p?: object) => void)(name, params as object | undefined);
  }
}

export function currentRoute(): { name: string; params: any } | null {
  if (!navigationRef.isReady()) return null;
  const r = navigationRef.getCurrentRoute();
  return r ? { name: r.name, params: (r.params as any) || {} } : null;
}
