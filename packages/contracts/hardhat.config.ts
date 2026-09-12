import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import type { HardhatUserConfig } from "hardhat/config";

// rpc-amoy.polygon.technology has been unreliable at the DNS level; publicnode
// is the working Amoy (chainId 80002) endpoint.
const AMOY_RPC_URL = process.env.BLOCKCHAIN_RPC_URL ?? "https://polygon-amoy-bor-rpc.publicnode.com";
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    amoy: {
      url: AMOY_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};

export default config;
