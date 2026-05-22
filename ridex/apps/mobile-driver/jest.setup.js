const secureStore = (() => {
  const store = new Map();
  return {
    WHEN_UNLOCKED: 1,
    getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    })
  };
})();

const constants = {
  default: {
    expoConfig: {
      extra: {
        apiBaseUrl: "http://localhost:3000/api/v1",
        wsUrl: "http://localhost:3000",
        mapboxToken: ""
      }
    }
  }
};

module.exports = { ...secureStore, ...constants };
module.exports.default = constants.default;
