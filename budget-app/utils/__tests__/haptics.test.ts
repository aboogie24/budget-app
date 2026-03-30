import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import {
  lightHaptic,
  mediumHaptic,
  successHaptic,
  errorHaptic,
} from '../haptics';

jest.mock('expo-haptics');
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: (obj) => obj.ios,
}));

describe('Haptics Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('lightHaptic', () => {
    it('should call impactAsync with Light feedback on non-web', () => {
      (Platform.OS as any) = 'ios';
      lightHaptic();
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    it('should not call impactAsync on web', () => {
      (Platform.OS as any) = 'web';
      lightHaptic();
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });
  });

  describe('mediumHaptic', () => {
    it('should call impactAsync with Medium feedback on non-web', () => {
      (Platform.OS as any) = 'ios';
      mediumHaptic();
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium
      );
    });

    it('should not call impactAsync on web', () => {
      (Platform.OS as any) = 'web';
      mediumHaptic();
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });

    it('should call impactAsync on Android', () => {
      (Platform.OS as any) = 'android';
      mediumHaptic();
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium
      );
    });
  });

  describe('successHaptic', () => {
    it('should call notificationAsync with Success feedback on non-web', () => {
      (Platform.OS as any) = 'ios';
      successHaptic();
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });

    it('should not call notificationAsync on web', () => {
      (Platform.OS as any) = 'web';
      successHaptic();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('errorHaptic', () => {
    it('should call notificationAsync with Error feedback on non-web', () => {
      (Platform.OS as any) = 'ios';
      errorHaptic();
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Error
      );
    });

    it('should not call notificationAsync on web', () => {
      (Platform.OS as any) = 'web';
      errorHaptic();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });

    it('should call notificationAsync on Android', () => {
      (Platform.OS as any) = 'android';
      errorHaptic();
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Error
      );
    });
  });

  describe('Platform-specific behavior', () => {
    it('should silently skip on web platform without errors', () => {
      (Platform.OS as any) = 'web';
      expect(() => {
        lightHaptic();
        mediumHaptic();
        successHaptic();
        errorHaptic();
      }).not.toThrow();
    });

    it('should work on iOS platform', () => {
      (Platform.OS as any) = 'ios';
      expect(() => {
        lightHaptic();
        mediumHaptic();
        successHaptic();
        errorHaptic();
      }).not.toThrow();
      expect(Haptics.impactAsync).toHaveBeenCalled();
      expect(Haptics.notificationAsync).toHaveBeenCalled();
    });
  });
});
