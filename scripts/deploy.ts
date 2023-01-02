import { ethers, upgrades, hardhatArguments } from "hardhat";

// Updates the factory contracts + implementation contract of each contract type
async function main() {
  let network = hardhatArguments.network?.toUpperCase() as string;

  // await deployContract("RevenueShareFactory", network);

  // await updateContract(
  //   "RevenueShareFactory",
  //   process.env[`${network}_REVENUE_SHARE_FACTORY_ADDRESS`] as string,
  //   network
  // );

  // await new Promise((resolve) => setTimeout(resolve, 3000));

  await updateContract(
    "CappedRevenueShareFactory",
    process.env[`${network}_CAPPED_REVENUE_SHARE_FACTORY_ADDRESS`] as string,
    network
  );

  // await new Promise((resolve) => setTimeout(resolve, 3000));

  // await updateContract(
  //   "ExpenseSubmissionFactory",
  //   process.env[`${network}_EXPENSE_SUBMISSION_FACTORY_ADDRESS`] as string,
  //   network
  // );
}

async function updateContract(name: string, address: string, network: string) {
  console.log(`Upgrading ${name} on ${network}...`);

  let contract = await ethers.getContractFactory(name);

  try {
    // Sometimes needed if .openzeppelin files aren't up to date
    await upgrades.forceImport(address, contract);
    console.log("Force import necessary");
  } catch (err) {}

  await upgrades.upgradeProxy(address, contract, {
    call: {
      fn: "updateImplementation",
      args: [],
    },
  });

  console.log(`${name} was successfully upgraded\n`);
}

async function updateImplementation(
  name: string,
  address: string,
  network: string
) {
  console.log(`Updating implementation for ${name} on ${network}...`);

  let contractFactory = await ethers.getContractFactory(name);
  let contract = contractFactory.attach(address);

  await contract.updateImplementation();
  await contract.deployed();

  console.log(`Implementation successfully updated\n`);
}

// Used to deploy a new proxy. This should only be called when there is reason not
// to upgrade the already deployed proxies.
async function deployContract(name: string, network: string) {
  console.log(`Deploying ${name} on ${network}...`);

  let contract = await ethers.getContractFactory(name);
  let instance = await upgrades.deployProxy(contract, [], {
    initializer: "initialize",
  });
  await instance.deployed();

  console.log(`${name} deployed to: ${instance.address}`);
}

// Allows using async/await everywhere and properly handling errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
