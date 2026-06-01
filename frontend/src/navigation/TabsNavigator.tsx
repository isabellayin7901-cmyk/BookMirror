import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { TodayBooksScreen } from '../screens/TodayBooksScreen';
import { LittleWorldScreen } from '../screens/LittleWorldScreen';
import { MyAccountScreen } from '../screens/MyAccountScreen';
import { MyFavoritesScreen } from '../screens/MyFavoritesScreen';

import { colors } from '../theme';
import { useI18n } from '../lib/LanguageContext';
import type { TabParamList } from '../types';

const Tab = createBottomTabNavigator<TabParamList>();

const TabIcon = ({ icon, focused }: { icon: string; focused: boolean }) => (
  <View style={styles.iconWrap}>
    <Text style={[styles.icon, { opacity: focused ? 1 : 0.55 }]}>{icon}</Text>
  </View>
);

export function TabsNavigator() {
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.terracotta,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 78,
          paddingTop: 8,
          paddingBottom: 22,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="TodayBooks"
        component={TodayBooksScreen}
        options={{
          tabBarLabel: t('tab.today'),
          tabBarIcon: ({ focused }) => <TabIcon icon="📖" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="LittleWorld"
        component={LittleWorldScreen}
        options={{
          tabBarLabel: t('tab.world'),
          tabBarIcon: ({ focused }) => <TabIcon icon="🌿" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="MyFavorites"
        component={MyFavoritesScreen}
        options={{
          tabBarLabel: t('tab.favorites'),
          tabBarIcon: ({ focused }) => <TabIcon icon="✨" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="MyAccount"
        component={MyAccountScreen}
        options={{
          tabBarLabel: t('tab.account'),
          tabBarIcon: ({ focused }) => <TabIcon icon="⛄" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  icon: { fontSize: 22 },
});
