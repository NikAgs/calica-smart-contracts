import { HardhatUserConfig } from "hardhat/config";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";
import "hardhat-gas-reporter";
import "@openzeppelin/hardhat-upgrades";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const config: HardhatUserConfig = {
  solidity: "0.8.7",
  gasReporter: {
    enabled: true,
    currency: "USD",
    coinmarketcap: "78804413-17d5-4257-84f3-52a645e0ecca",
  },
  networks: {
    mumbai: {
      url: "https://matic-mumbai.chainstacklabs.com",
      accounts: [process.env["TESTNET_PRIVATE_KEY"] as string],
    },
  },
};

export default config;
