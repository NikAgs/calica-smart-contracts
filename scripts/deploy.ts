import { ethers } from "hardhat";

async function main() {
  const RevenueShare = await ethers.getContractFactory("RevenueShare");
  console.log("Deploying RevenueShare...");

  let revenueShare = await RevenueShare.deploy();
  await revenueShare.deployed();

  console.log("RevenueShare deployed to:", revenueShare.address);
}

// Allows using async/await everywhere and properly handling errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
