import { expect } from "chai";
import { ethers, network } from "hardhat";

describe("RevenueShare", function () {
	// Initialize global test variables
	before(async function () {
		this.RevenueShare = await ethers.getContractFactory("RevenueShare");

		let signers = await ethers.getSigners();
		this.moneySender = signers[0];
		this.adam = signers[1];
		this.nik = signers[2];
	});

	// Create a brand new RevenueShare contract before each test
	beforeEach(async function () {
		await network.provider.send("hardhat_reset");
		this.revenueShare = await this.RevenueShare.deploy();
		await this.revenueShare.deployed();
	});

	it("fails to initialize with an empty split", async function () {
		try {
			await this.revenueShare.initialize({
				name: "Failed Initialize",
				splits: [],
			});
		} catch (e: any) {
			expect(e.message).to.contain("No splits configured");
		}
	});

	it("fails when percentages don't add up to 100000", async function () {
		try {
			await this.revenueShare.initialize({
				name: "Failed Initialize",
				splits: [
					{
						account: this.adam.address,
						percentage: 80000,
					},
					{
						account: this.nik.address,
						percentage: 90000,
					},
				],
			});
		} catch (e: any) {
			expect(e.message).to.contain("Percentages must equal 1e5");
		}
	});

	it("fails when receiving funds before being initialized", async function () {
		try {
			await this.moneySender.sendTransaction({
				to: this.revenueShare.address,
				value: ethers.utils.parseEther("3"),
			});
		} catch (e: any) {
			expect(e.message).to.contain("No splits configured");
		}
	});

	it("sets name correctly", async function () {
		await initializeValidRevenueShare.bind(this)();

		let name = await this.revenueShare.name();
		expect(name).to.equal("Valid Revenue Share");
	});

	it("sets splits correctly", async function () {
		await initializeValidRevenueShare.bind(this)();

		let firstSplit = await this.revenueShare.splits(0);
		let secondSplit = await this.revenueShare.splits(1);

		expect(firstSplit.account).to.equal(this.adam.address);
		expect(firstSplit.percentage).to.equal(50000);

		expect(secondSplit.account).to.equal(this.nik.address);
		expect(secondSplit.percentage).to.equal(50000);
	});

	it("distributes funds correctly", async function () {
		await initializeValidRevenueShare.bind(this)();

		await checkBalance(this.revenueShare.address, 0n);
		await checkBalance(this.adam.address, 10000000000000000000000n);
		await checkBalance(this.nik.address, 10000000000000000000000n);

		await this.moneySender.sendTransaction({
			to: this.revenueShare.address,
			value: ethers.utils.parseEther("3"),
		});

		await checkBalance(this.revenueShare.address, 0n);
		await checkBalance(this.adam.address, 10001500000000000000000n);
		await checkBalance(this.nik.address, 10001500000000000000000n);
	});

	// helper function to set up a 50/50 split
	async function initializeValidRevenueShare(
		this: Mocha.Context
	): Promise<void> {
		await this.revenueShare.initialize({
			name: "Valid Revenue Share",
			splits: [
				{
					account: this.adam.address,
					percentage: 50000,
				},
				{
					account: this.nik.address,
					percentage: 50000,
				},
			],
		});
	}

	// helper function to check the node balance
	async function checkBalance(
		address: any,
		expectedBalance: bigint
	): Promise<void> {
		let balance = await ethers.provider.getBalance(address);
		expect(balance).to.equal(expectedBalance);
	}
});
