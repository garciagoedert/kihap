import React from 'react';
import { Stack } from 'expo-router';
import PublicProfileView from '../../src/components/PublicProfileView';

export default function PublicProfileScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PublicProfileView />
    </>
  );
}
