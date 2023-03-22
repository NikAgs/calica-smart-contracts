import { HardhatUserConfig } from "hardhat/config";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";
import "hardhat-gas-reporter";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-abi-exporter";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.7",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    coinmarketcap: "78804413-17d5-4257-84f3-52a645e0ecca",
  },
  abiExporter: {
    runOnCompile: true,
  },
  networks: {
    mumbai: {
      url: process.env["MUMBAI_ALCHEMY_URL"] as string,
      accounts: [process.env["TESTNET_PRIVATE_KEY"] as string],
      gasMultiplier: 5,
      timeout: 120000,
    },
    goerli: {
      url: process.env["GOERLI_ALCHEMY_URL"] as string,
      accounts: [process.env["TESTNET_PRIVATE_KEY"] as string],
      gasMultiplier: 5,
      timeout: 120000,
    },
    ethereum: {
      url: process.env["ETHEREUM_ALCHEMY_URL"] as string,
      accounts: [process.env["TESTNET_PRIVATE_KEY"] as string],
      gasMultiplier: 1,
      timeout: 120000,
    },
    matic: {
      url: process.env["POLYGON_ALCHEMY_URL"] as string,
      accounts: [process.env["TESTNET_PRIVATE_KEY"] as string],
      gasMultiplier: 5,
      timeout: 120000,
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      forking: {
        url: process.env["ETHEREUM_ALCHEMY_URL"] as string,
        blockNumber: 15792160,
      },
    },
    localhost: {
      allowUnlimitedContractSize: true,
    },
  },
};

export default config;
