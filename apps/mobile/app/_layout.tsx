import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { Colors } from '../constants/colors';
export default function RootLayout() {
  const { isAuthenticated, isLoading, loadFromStorage } = useAuthStore();
  useEffect(() => { loadFromStorage(); }, []);
  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) router.replace('/(app)/dashboard');
    else router.replace('/(auth)/login');
  }, [isAuthenticated, isLoading]);
  if (isLoading) return <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:Colors.bgPage }}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  return (<><StatusBar style="light" /><Stack screenOptions={{ headerShown:false }}><Stack.Screen name="(auth)" /><Stack.Screen name="(app)" /></Stack></>);
}
