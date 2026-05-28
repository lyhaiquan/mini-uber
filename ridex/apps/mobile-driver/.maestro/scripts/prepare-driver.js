const runId = `${MAESTRO_ENV.FLOW_PREFIX || "driver"}-${Date.now()}`;
const payload = {
  mode: "prepare",
  testRunId: runId,
  pickup: {
    lat: Number(MAESTRO_ENV.SEED_PICKUP_LAT),
    lng: Number(MAESTRO_ENV.SEED_PICKUP_LNG)
  },
  destination: {
    lat: Number(MAESTRO_ENV.SEED_DEST_LAT),
    lng: Number(MAESTRO_ENV.SEED_DEST_LNG)
  }
};

const response = http.post(`${MAESTRO_ENV.API_BASE_URL}/testing/seed-driver-offer`, {
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});

if (response.status >= 400) {
  throw new Error(`prepare seed failed: HTTP ${response.status} ${response.body}`);
}

const data = json(response.body);

output.SEED_RUN_ID = data.testRunId;
output.SEED_DRIVER_EMAIL = data.driver.email;
output.SEED_DRIVER_PASSWORD = data.driver.password;
output.SEED_DRIVER_USER_ID = data.driver.userId;
