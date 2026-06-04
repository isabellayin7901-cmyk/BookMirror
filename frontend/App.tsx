import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, ZCOOLKuaiLe_400Regular } from '@expo-google-fonts/zcool-kuaile';

import { TabsNavigator } from './src/navigation/TabsNavigator';
import { LanguageSelectScreen } from './src/screens/LanguageSelectScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { PhoneAuthScreen } from './src/screens/PhoneAuthScreen';
import { QuizScreen } from './src/screens/QuizScreen';
import { ResultScreen } from './src/screens/ResultScreen';
import { FeedbackScreen } from './src/screens/FeedbackScreen';
import { BookReviewScreen } from './src/screens/BookReviewScreen';
import { GrowthScreen } from './src/screens/GrowthScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ProfileHomeScreen } from './src/screens/ProfileHomeScreen';
import { SocialListScreen } from './src/screens/SocialListScreen';
import { AddFriendScreen } from './src/screens/AddFriendScreen';
import { DMChatScreen } from './src/screens/DMChatScreen';
import { PrivacyScreen } from './src/screens/PrivacyScreen';
import { IncomingBanner } from './src/components/IncomingBanner';
import { PersonaScreen } from './src/screens/PersonaScreen';
import { AstrologyScreen } from './src/screens/AstrologyScreen';
import { AstrologyResultScreen } from './src/screens/AstrologyResultScreen';
import { GenderScreen } from './src/screens/GenderScreen';
import { MirrorChatScreen } from './src/screens/MirrorChatScreen';
import { storage } from './src/lib/storage';
import { LanguageProvider } from './src/lib/LanguageContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { colors } from './src/theme';
import type { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [fontsLoaded] = useFonts({ ZCOOLKuaiLe_400Regular });

  useEffect(() => {
    storage.getOnboarded().then((v) => setOnboarded(v));
    // 启动时从账号拉取档案合并（新设备登录后能恢复 性别/星座/MBTI/用户名）。
    import('./src/lib/api').then((m) => m.hydrateAccountProfile()).catch(() => {});
  }, []);

  if (onboarded === null || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.terracotta} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <LanguageProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator
          initialRouteName={onboarded ? 'Tabs' : 'LanguageSelect'}
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
            headerTitle: '',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
          <Stack.Screen
            name="LanguageSelect"
            component={LanguageSelectScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
          <Stack.Screen
            name="Quiz"
            component={QuizScreen}
            initialParams={{ onboarding: !onboarded }}
          />
          <Stack.Screen name="Result" component={ResultScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Feedback" component={FeedbackScreen} />
          <Stack.Screen name="BookReview" component={BookReviewScreen} />
          <Stack.Screen name="Growth" component={GrowthScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen
            name="ProfileHome"
            component={ProfileHomeScreen}
            options={{ headerShown: false, animation: 'slide_from_right' }}
          />
          <Stack.Screen name="SocialList" component={SocialListScreen} options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="AddFriend" component={AddFriendScreen} options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="DMChat" component={DMChatScreen} options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="Persona" component={PersonaScreen} />
          <Stack.Screen name="Astrology" component={AstrologyScreen} />
          <Stack.Screen name="AstrologyResult" component={AstrologyResultScreen} />
          <Stack.Screen name="Gender" component={GenderScreen} options={{ headerShown: false }} />
          <Stack.Screen name="MirrorChat" component={MirrorChatScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
        {/* 好友消息弹跳横幅（全局，叠在导航之上） */}
        <IncomingBanner />
      </NavigationContainer>
      </LanguageProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}
