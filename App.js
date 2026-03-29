import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { initDB } from './src/database/db';
import LibraryScreen from './src/screens/LibraryScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import { View, Text, ActivityIndicator, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const Stack = createNativeStackNavigator();

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await initDB();
        if (isMounted) setDbReady(true);
      } catch (e) {
        console.error("DB Initialization failed", e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF6F0' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF6F0" />
        <ActivityIndicator size="large" color="#8B6914" />
        <Text style={{ marginTop: 14, color: '#8B6914', fontSize: 15, fontWeight: '500' }}>Loading your library…</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF6F0" />
      <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Library" 
        screenOptions={{ 
          headerStyle: { backgroundColor: '#FAF6F0' },
          headerTintColor: '#8B6914',
          headerTitleStyle: { fontWeight: '600', color: '#2C2C2C' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen 
          name="Library" 
          component={LibraryScreen} 
          options={{ title: 'My Library' }} 
        />
        <Stack.Screen 
          name="Reader" 
          component={ReaderScreen} 
          options={{ headerShown: false }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
    </GestureHandlerRootView>
  );
}
