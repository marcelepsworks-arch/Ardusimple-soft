/**
 * App module smoke test.
 * Full component rendering requires native modules (navigation, maps, BLE),
 * which aren't available in a Jest environment without extensive mocking.
 * The NMEA parser tests cover the critical business logic.
 */

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({children}: any) => children,
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({children}: any) => children,
    Screen: () => null,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: any) => children,
}));
jest.mock('react-native-maps', () => 'MapView');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-ble-plx', () => ({BleManager: jest.fn()}));
jest.mock('react-native-tcp-socket', () => ({createConnection: jest.fn()}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({data: {session: null}}),
      getUser: jest.fn().mockResolvedValue({data: {user: null}}),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({data: null}),
        }),
      }),
    }),
  }),
}));
jest.mock('react-native-url-polyfill/auto', () => {});

import React from 'react';

test('App module exports a default component', () => {
  const App = require('../App').default;
  expect(App).toBeDefined();
  expect(typeof App).toBe('function');
});
