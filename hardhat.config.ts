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
				runs: 200
			}
		}
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
			url: "https://matic-mumbai.chainstacklabs.com",
			accounts: [process.env["TESTNET_PRIVATE_KEY"] as string],
			gasPrice: 800000000000,
			gasMultiplier: 5,
			timeout: 120000,
		},
		hardhat: {
			allowUnlimitedContractSize: true,
		},
		localhost: {
			allowUnlimitedContractSize: true,
		}
	},
};

export default config;
