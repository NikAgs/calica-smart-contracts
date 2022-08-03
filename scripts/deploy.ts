import { ethers } from "hardhat";

async function main() {
  const CappedRevenueShare = await ethers.getContractFactory("CappedRevenueShare");
  console.log("Deploying CappedRevenueShare...");

  let cappedRevenueShare = await CappedRevenueShare.deploy();
  await cappedRevenueShare.deployed();

  console.log("CappedRevenueShare deployed to:", cappedRevenueShare.address);
}

// Allows using async/await everywhere and properly handling errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
