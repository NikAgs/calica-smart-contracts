import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";
import "hardhat-gas-reporter";

const config: HardhatUserConfig = {
  solidity: "0.8.9",
  gasReporter: {
    enabled: true,
    currency: "USD",
    coinmarketcap: "78804413-17d5-4257-84f3-52a645e0ecca"
  }
};

export default config;