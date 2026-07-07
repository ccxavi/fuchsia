import { useState, useCallback } from 'react';
import { Animated } from 'react-native';

export function useToast() {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('Changes saved successfully');
  const [fadeAnim] = useState(new Animated.Value(0));

  const showToast = useCallback((message = 'Changes saved successfully') => {
    setToastMessage(message);
    setToastVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setToastVisible(false);
      });
    }, 2500);
  }, [fadeAnim]);

  return { toastVisible, toastMessage, fadeAnim, showToast };
}
