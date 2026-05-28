const payload = {
  mode: "dispatch-offer",
  testRunId: output.SEED_RUN_ID,
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
  throw new Error(`dispatch seed failed: HTTP ${response.status} ${response.body}`);
}

const data = json(response.body);

output.SEED_OFFER_ID = data.offerId;
output.SEED_RIDE_ID = data.rideId;
