const PermissionStatus = {
  GRANTED: "granted",
  DENIED: "denied",
  UNDETERMINED: "undetermined"
};

const Accuracy = { Balanced: 3, High: 4 };

const getForegroundPermissionsAsync = jest.fn(async () => ({
  status: PermissionStatus.UNDETERMINED,
  granted: false,
  canAskAgain: true,
  expires: "never"
}));

const requestForegroundPermissionsAsync = jest.fn(async () => ({
  status: PermissionStatus.GRANTED,
  granted: true,
  canAskAgain: true,
  expires: "never"
}));

const getCurrentPositionAsync = jest.fn(async () => ({
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

module.exports = {
  PermissionStatus,
  Accuracy,
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
  getCurrentPositionAsync
};
