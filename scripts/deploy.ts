import { ethers, upgrades } from "hardhat";

async function main() {
	// await updateContract("RevenueShareFactory",
	// 	process.env["TESTNET_REVENUE_SHARE_FACTORY_ADDRESS"] as string);

	// updateImplementation("RevenueShareFactory", process.env["TESTNET_REVENUE_SHARE_FACTORY_ADDRESS"] as string);

	// await updateContract("CappedRevenueShareFactory",
	// 	process.env["TESTNET_CAPPED_REVENUE_SHARE_FACTORY_ADDRESS"] as string);

	// updateImplementation("CappedRevenueShareFactory", process.env["TESTNET_CAPPED_REVENUE_SHARE_FACTORY_ADDRESS"] as string);

}

async function updateContract(name: string, address: string) {
	let contract = await ethers.getContractFactory(name);

	// await upgrades.forceImport(address, contract);

	console.log(`Upgrading ${name}...`);
	await upgrades.upgradeProxy(address, contract);

	console.log(`${name} was successfully upgraded\n`);
}

async function updateImplementation(name: string, address: string) {
	let contractFactory = await ethers.getContractFactory(name);
	let contract = contractFactory.attach(address);

	contract.updateImplementation();
}

// Used to deploy a new proxy. This should only be called when there is reason not
// to upgrade the already deployed proxies.
async function deployContract(name: string) {
	let contract = await ethers.getContractFactory(name);
	console.log(`Deploying ${name}...`);

	let instance = await upgrades.deployProxy(contract);
	await instance.deployed();

	console.log(`${name} deployed to: ${instance.address}`);
}

// Allows using async/await everywhere and properly handling errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
