import { expect } from "chai";
import { ethers } from "hardhat";

describe("CappedRevenueShare", function () {
  // Initialize global test variables
  before(async function () {
    this.CappedRevenueShare = await ethers.getContractFactory(
      "CappedRevenueShare"
    );

    let signers = await ethers.getSigners();
    this.moneySender = signers[0];
    this.adam = signers[1];
    this.nik = signers[2];
  });

  // Create a brand new CappedRevenueShare contract before each test
  beforeEach(async function () {
    this.cappedRevenueShare = await this.CappedRevenueShare.deploy();
    await this.cappedRevenueShare.deployed();
  });

  it("fails to initialize with an empty capped splits", async function () {
    try {
      await this.cappedRevenueShare.initialize({
        name: "Failed Initialize",
        cappedSplits: [],
      });
    } catch (e: any) {
      expect(e.message).to.contain("No capped splits configured");
    }
  });
});

// it("fails to initialize with a non-zero first cap", async function () {});

// it("fails to initialize with a non-zero first cap", async function () {});
