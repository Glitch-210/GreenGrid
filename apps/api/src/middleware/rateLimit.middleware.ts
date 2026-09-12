import rateLimit from "express-rate-limit";

export const loginRateLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts", errorCode: "RATE_LIMITED" },
});

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests", errorCode: "RATE_LIMITED" },
});
