import { env } from "../../config/env";
import { MockUtilityAdapter } from "./MockUtilityAdapter";
import type { UtilityAdapter } from "./UtilityAdapter";

export * from "./UtilityAdapter";

export const utilityAdapter: UtilityAdapter = (() => {
  switch (env.utilityAdapter) {
    case "mock":
    default:
      return new MockUtilityAdapter();
  }
})();
