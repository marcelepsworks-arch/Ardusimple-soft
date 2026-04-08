import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {MapScreen} from '../screens/MapScreen';
import {DeviceScreen} from '../screens/DeviceScreen';
import {NtripScreen} from '../screens/NtripScreen';
import {CollectScreen} from '../screens/CollectScreen';
import {ProjectsScreen} from '../screens/ProjectsScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {ExportScreen} from '../screens/ExportScreen';
import {StakeoutScreen} from '../screens/StakeoutScreen';
import {CogoScreen} from '../screens/CogoScreen';
import {DtmScreen} from '../screens/DtmScreen';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: '#0a0a0a'},
        headerTintColor: '#e5e7eb',
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#1f2937',
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
      }}>
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({color, size}) => (
            <Icon name="map" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Device"
        component={DeviceScreen}
        options={{
          title: 'Device',
          tabBarIcon: ({color, size}) => (
            <Icon name="bluetooth" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="NTRIP"
        component={NtripScreen}
        options={{
          title: 'NTRIP',
          tabBarIcon: ({color, size}) => (
            <Icon name="access-point" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Collect"
        component={CollectScreen}
        options={{
          title: 'Collect',
          tabBarIcon: ({color, size}) => (
            <Icon name="crosshairs-gps" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{
          title: 'Projects',
          tabBarIcon: ({color, size}) => (
            <Icon name="folder" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="DTM"
        component={DtmScreen}
        options={{
          title: 'DTM',
          tabBarIcon: ({color, size}) => (
            <Icon name="terrain" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="COGO"
        component={CogoScreen}
        options={{
          title: 'COGO',
          tabBarIcon: ({color, size}) => (
            <Icon name="vector-triangle" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Stakeout"
        component={StakeoutScreen}
        options={{
          title: 'Stakeout',
          tabBarIcon: ({color, size}) => (
            <Icon name="target" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Export"
        component={ExportScreen}
        options={{
          title: 'Export',
          tabBarIcon: ({color, size}) => (
            <Icon name="export-variant" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({color, size}) => (
            <Icon name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
