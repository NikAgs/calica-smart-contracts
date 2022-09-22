import { expect } from "chai";
import { ethers, network } from "hardhat";
import path from "path";

describe("RevenueShare", function () {
	// Initialize global test variables
	before(async function () {
		this.RevenueShare = await ethers.getContractFactory("RevenueShare");

		let signers = await ethers.getSigners();
		this.moneySender = signers[0];
		this.adam = signers[1];
		this.nik = signers[2];
		this.owner = signers[3];
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
				contractName: "Failed Initialize",
				splits: [],
			}, this.owner.address, false);
		} catch (e: any) {
			expect(e.message).to.contain("No splits configured");
		}
	});

	it("fails when percentages don't add up to 100000", async function () {
		try {
			await this.revenueShare.initialize({
				contractName: "Failed Initialize",
				splits: [
					{
						name: "Adam",
						account: this.adam.address,
						percentage: 80000,
					},
					{
						name: "Nik",
						account: this.nik.address,
						percentage: 90000,
					},
				],
			}, this.owner.address, false);
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

	it("fails when trying to reconfigure before being initialized", async function () {
		try {
			await this.revenueShare.reconfigureSplits([
				{
					name: "Adam",
					account: this.adam.address,
					percentage: 100000,
				}
			]);
		} catch (e: any) {
			expect(e.message).to.contain("Contract isnt reconfigurable");
		}
	});

	it("fails to reconfigure splits when flag is set to false", async function () {
		try {
			await initializeValidRevenueShare.bind(this)();

			await this.revenueShare.reconfigureSplits([
				{
					name: "Adam",
					account: this.adam.address,
					percentage: 100000,
				}
			]);
		} catch (e: any) {
			expect(e.message).to.contain("Contract isnt reconfigurable");
		}
	});

	it("fails to reconfigure when non-owner calls it", async function () {
		try {
			await initializeValidRevenueShare.bind(this, true)();

			await this.revenueShare.connect(this.adam).reconfigureSplits([
				{
					name: "Adam",
					account: this.adam.address,
					percentage: 100000,
				}
			]);
		} catch (e: any) {
			expect(e.message).to.contain("Only owner can reconfigure");
		}
	});

	it("sets contract name correctly", async function () {
		await initializeValidRevenueShare.bind(this)();

		let contractName = await this.revenueShare.contractName();
		expect(contractName).to.equal("Valid Revenue Share");
	});

	it("sets owner correctly", async function () {
		await initializeValidRevenueShare.bind(this)();

		let owner = await this.revenueShare.owner();
		expect(owner).to.equal(this.owner.address);
	});

	it("sets splits correctly", async function () {
		await initializeValidRevenueShare.bind(this)();

		let splits = await this.revenueShare.getSplits();
		let firstSplit = await splits[0];
		let secondSplit = splits[1];

		expect(firstSplit.account).to.equal(this.adam.address);
		expect(firstSplit.percentage).to.equal(50000);

		expect(secondSplit.account).to.equal(this.nik.address);
		expect(secondSplit.percentage).to.equal(50000);
	});

	it("can reconfigure splits correctly", async function () {
		await initializeValidRevenueShare.bind(this, true)();

		let initialSplits = await this.revenueShare.getSplits();

		await this.revenueShare.connect(this.owner).reconfigureSplits([
			{
				name: "Adam",
				account: this.adam.address,
				percentage: 100000,
			}
		]);

		let reconfiguredSplits = await this.revenueShare.getSplits();

		expect(initialSplits.length).to.equal(2);

		expect(reconfiguredSplits.length).to.equal(1);
		expect(reconfiguredSplits[0].name).to.equal("Adam");
		expect(reconfiguredSplits[0].account).to.equal(this.adam.address);
		expect(reconfiguredSplits[0].percentage).to.equal(100000);
	});

	it("gets splits correctly", async function () {
		await initializeValidRevenueShare.bind(this)();

		let splits = await this.revenueShare.getSplits();

		expect(splits[0].name).to.equal("Adam");
		expect(splits[0].account).to.equal(this.adam.address);
		expect(splits[0].percentage).to.equal(50000);

		expect(splits[1].name).to.equal("Nik");
		expect(splits[1].account).to.equal(this.nik.address);
		expect(splits[1].percentage).to.equal(50000);
	})

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

	it("emits withdraw events correctly", async function () {
		await initializeValidRevenueShare.bind(this)();

		await this.moneySender.sendTransaction({
			to: this.revenueShare.address,
			value: ethers.utils.parseEther("10"),
		});

		let events = await getLogs(this.revenueShare.address);

		expect(events.length).to.equal(2);
		expect(events[0].amount).to.equal(5000000000000000000n);
		expect(events[0].account).to.equal(this.adam.address);

		expect(events[1].amount).to.equal(5000000000000000000n);
		expect(events[1].account).to.equal(this.nik.address);

		expect(events[0].timestamp).to.equal(events[1].timestamp);
	});

	// helper function to set up a 50/50 split
	async function initializeValidRevenueShare(
		this: Mocha.Context,
		reconfigurable: boolean = false,
	): Promise<void> {
		await this.revenueShare.connect(this.owner).initialize({
			contractName: "Valid Revenue Share",
			splits: [
				{
					name: "Adam",
					account: this.adam.address,
					percentage: 50000,
				},
				{
					name: "Nik",
					account: this.nik.address,
					percentage: 50000,
				},
			],
		}, this.owner.address, reconfigurable);
	}
});

// helper function to check the node balance
async function checkBalance(
	address: any,
	expectedBalance: bigint
): Promise<void> {
	let balance = await ethers.provider.getBalance(address);
	expect(balance).to.equal(expectedBalance);
}

const getLogs = async (address: string) => {
	let revShareABI = require(path.resolve(__dirname, "../../abi/contracts/RevenueShare/RevenueShare.sol/RevenueShare.json"))
	let contractInterface = new ethers.utils.Interface(revShareABI)
	let events = await ethers.provider.getLogs({
		fromBlock: 0,
		toBlock: 'latest',
		address: address,
	}).then((events) => {
		return events.map((e) => {
			return contractInterface.parseLog(e).args
		}).filter((events) => {
			return events.amount;
		});
	})
	return events;
}