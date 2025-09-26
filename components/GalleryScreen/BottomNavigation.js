import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Images, Archive, Camera, Wrench, Lock } from 'lucide-react-native';
import { galleryStyles as styles } from '../../styles/galleryStyles';

const BottomNavigation = ({ activeTab, onTabPress }) => {
  const tabs = [
    { id: 'local', icon: Images, label: 'Local' },
    { id: 'storage', icon: Archive, label: 'Storage' },
    { id: 'camera', icon: Camera, label: 'Camera', isMain: true },
    { id: 'tools', icon: Wrench, label: 'Tools' },
    { id: 'lock', icon: Lock, label: 'Lock' },
  ];

  return (
    <View style={styles.bottomNav}>
      {tabs.map(({ id, icon: Icon, label, isMain }) => {
        const isActive = activeTab === id;
        return (
          <TouchableOpacity
            key={id}
            onPress={() => onTabPress(id)}
            style={[
              styles.tab,
              isMain && styles.mainTab,
              isMain && {
                backgroundColor: isActive ? 'white' : 'rgba(255,255,255,0.8)',
              },
            ]}
          >
            <Icon
              size={isMain ? 24 : 20}
              color={isMain ? 'black' : isActive ? 'white' : 'gray'}
            />
            {!isMain && (
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? 'white' : 'gray' },
                ]}
              >
                {label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default BottomNavigation;
