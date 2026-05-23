export type LocationErrorCode =
  | "INVALID_PAYLOAD"
  | "DRIVER_OFFLINE"
  | "STALE_TIMESTAMP"
  | "GPS_JUMP_DISTANCE"
  | "GPS_JUMP_SPEED"
  | "INTERNAL";

export type LocationAck =
  | { ok: true }
  | {
      ok: false;
      error: {
        code: LocationErrorCode;
        message: string;
      };
    };

export function locationAckError(code: LocationErrorCode, message: string): LocationAck {
  return {
    ok: false,
    error: {
      code,
      message
    }
  };
}

