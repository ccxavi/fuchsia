import { useState, useCallback, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { CustomAlertProps } from '@/components/ui/CustomAlert';

type GlobalAlertConfig = Omit<CustomAlertProps, 'visible' | 'onCancel'> & {
  onCancel?: () => void;
};

export function useGlobalAlert() {
  const [alertConfig, setAlertConfig] = useState<GlobalAlertConfig | null>(null);

  const showAlert = useCallback((config: GlobalAlertConfig) => {
    setAlertConfig(config);
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig(null);
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('showGlobalAlert', (config: GlobalAlertConfig) => {
      showAlert(config);
    });
    
    const hideSubscription = DeviceEventEmitter.addListener('hideGlobalAlert', () => {
      hideAlert();
    });

    return () => {
      subscription.remove();
      hideSubscription.remove();
    };
  }, [showAlert, hideAlert]);

  return {
    alertConfig,
    hideAlert,
  };
}
