export const PermissionStatus = {
  GRANTED: "granted",
  DENIED: "denied",
  UNDETERMINED: "undetermined"
} as const;

export const Accuracy = { Balanced: 3, High: 4 };

export const getForegroundPermissionsAsync = jest.fn(async () => ({
  status: PermissionStatus.UNDETERMINED,
  granted: false,
  canAskAgain: true,
  expires: "never"
}));

export const requestForegroundPermissionsAsync = jest.fn(async () => ({
  status: PermissionStatus.GRANTED,
  granted: true,
  canAskAgain: true,
  expires: "never"
}));

export const getCurrentPositionAsync = jest.fn(async () => ({
  coords: {
    latitude: 10.776,
    longitude: 106.7,
    altitude: null,
    accuracy: 10,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  },
  timestamp: Date.now()
}));
