import { upgrades, ethers } from "hardhat";

async function main() {
  // console.log("Staging private key:", process.env.TESTNET_PRIVATE_KEY);
  await update();
}

async function initialize() {
  const Box = await ethers.getContractFactory('Box');
  console.log('Deploying Box...');
  const box = await upgrades.deployProxy(Box, [42], { initializer: 'store' });
  await box.deployed();
  console.log('Box deployed to:', box.address);
}

async function update() {
  const Box = await ethers.getContractFactory("Box");
  const box = await upgrades.upgradeProxy("0x2d8B2608Bbbfe80c0cf5580571808a2D97a06177", Box);
  console.log("Box upgraded");
}

// Allows using async/await everywhere and properly handling errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
