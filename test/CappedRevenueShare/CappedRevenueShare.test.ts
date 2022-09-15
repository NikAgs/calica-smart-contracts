import { expect } from "chai";
import { ethers, network } from "hardhat";
import path from "path";

describe("CappedRevenueShare", function () {
	// Initialize global test variables
	before(async function () {
		this.CappedRevenueShare = await ethers.getContractFactory(
			"CappedRevenueShare"
		);

		this.signers = await ethers.getSigners();
		this.moneySender = this.signers[0];
		this.firstAccount = this.signers[1];
		this.secondAccount = this.signers[2];
		this.thirdAccount = this.signers[3];
		this.owner = this.signers[4];
	});


	// Create a brand new CappedRevenueShare contract before each test
	beforeEach(async function () {
		await network.provider.send("hardhat_reset");
		this.cappedRevenueShare = await this.CappedRevenueShare.deploy();
		await this.cappedRevenueShare.deployed();
	});

	it("fails to initialize with an empty capped splits", async function () {
		try {
			await this.cappedRevenueShare.initialize({
				contractName: "Failed Initialize",
				cappedSplits: [],
			}, this.owner.address, false);
		} catch (e: any) {
			expect(e.message).to.contain("No capped splits given");
		}
	});

	it("fails to initialize with a non-zero first cap", async function () {
		try {
			await this.cappedRevenueShare.initialize({
				contractName: "Failed Initialize",
				cappedSplits: getCappedSplits.call(this, ["10"], [[100000]]),
			}, this.owner.address, false);
		} catch (e: any) {
			expect(e.message).to.contain("First cap must be 0");
		}
	});

	it("fails to initialize with a split not adding up to 100000", async function () {
		try {
			await this.cappedRevenueShare.initialize({
				contractName: "Failed Initialize",
				cappedSplits: getCappedSplits.call(
					this,
					["0", "100"],
					[[100000], [10000, 50000]]
				),
			}, this.owner.address, false);
		} catch (e: any) {
			expect(e.message).to.contain("Percentages must equal 1e5");
		}
	});

	it("fails when receiving funds before being initialized", async function () {
		try {
			await this.moneySender.sendTransaction({
				to: this.cappedRevenueShare.address,
				value: ethers.utils.parseEther("3"),
			});
		} catch (e: any) {
			expect(e.message).to.contain("No splits configured");
		}
	});

	it("fails to initialize with unsorted caps", async function () {
		try {
			await this.cappedRevenueShare.initialize({
				contractName: "Failed Initialize",
				cappedSplits: getCappedSplits.call(
					this,
					["0", "100", "50"],
					[[100000], [50000, 50000], [33333, 33333, 33334]]
				),
			}, this.owner.address, false);
		} catch (e: any) {
			expect(e.message).to.contain("Caps must be sorted and unique");
		}
	});

	it("fails when trying to reconfigure before being initialized", async function () {
		try {
			await this.cappedRevenueShare.reconfigureCappedSplits(getCappedSplits.call(
				this,
				["0", "3", "10"],
				[[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
			));
		} catch (e: any) {
			expect(e.message).to.contain("Contract isnt reconfigurable");
		}
	});

	it("fails to reconfigure splits when flag is set to false", async function () {
		try {
			await this.cappedRevenueShare.initialize({
				contractName: "Valid Initializer",
				cappedSplits: getCappedSplits.call(
					this,
					["0", "3", "10"],
					[[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
				),
			}, this.owner.address, false);

			await this.cappedRevenueShare.reconfigureCappedSplits(getCappedSplits.call(
				this,
				["0", "3", "10"],
				[[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
			));
		} catch (e: any) {
			expect(e.message).to.contain("Contract isnt reconfigurable");
		}
	});

	it("fails to reconfigure when non-owner calls it", async function () {
		try {
			await this.cappedRevenueShare.connect(this.owner).initialize({
				contractName: "Valid Initializer",
				cappedSplits: getCappedSplits.call(
					this,
					["0", "3", "10"],
					[[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
				),
			}, this.owner.address, true);

			await this.cappedRevenueShare.connect(this.firstAccount).reconfigureCappedSplits(getCappedSplits.call(
				this,
				["0", "3", "10"],
				[[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
			));
		} catch (e: any) {
			expect(e.message).to.contain("Only owner can reconfigure");
		}
	});

	it("sets valid input correctly", async function () {
		await this.cappedRevenueShare.initialize({
			contractName: "Valid Initializer",
			cappedSplits: getCappedSplits.call(
				this,
				["0", "3", "10"],
				[[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
			),
		}, this.owner.address, false);

		let cappedSplits = await this.cappedRevenueShare.getCappedSplits();

		let firstCappedSplit = cappedSplits[0];
		let secondCappedSplit = cappedSplits[1];
		let thirdCappedSplit = cappedSplits[2];

		expect(cappedSplits.length).to.equal(3);

		let firstCap = firstCappedSplit.cap;
		let secondCap = secondCappedSplit.cap;
		let thirdCap = thirdCappedSplit.cap;
		expect(firstCap).to.equal(0n);
		expect(secondCap).to.equal(ethers.utils.parseEther("3"));
		expect(thirdCap).to.equal(ethers.utils.parseEther("10"));

		let firstSplits = firstCappedSplit.splits;
		expect(firstSplits[0].name).to.equal("Account 0");
		expect(firstSplits[0].account).to.equal(this.firstAccount.address);
		expect(firstSplits[0].percentage).to.equal(100000);
		expect(firstSplits.length).to.equal(1);

		let secondSplits = secondCappedSplit.splits;
		expect(secondSplits[0].name).to.equal("Account 0");
		expect(secondSplits[0].account).to.equal(this.firstAccount.address);
		expect(secondSplits[0].percentage).to.equal(5000);
		expect(secondSplits[1].name).to.equal("Account 1");
		expect(secondSplits[1].account).to.equal(this.secondAccount.address);
		expect(secondSplits[1].percentage).to.equal(5000);
		expect(secondSplits[2].name).to.equal("Account 2");
		expect(secondSplits[2].account).to.equal(this.thirdAccount.address);
		expect(secondSplits[2].percentage).to.equal(90000);
		expect(secondSplits.length).to.equal(3);

		let thirdSplits = thirdCappedSplit.splits;
		expect(thirdSplits[0].name).to.equal("Account 0");
		expect(thirdSplits[0].account).to.equal(this.firstAccount.address);
		expect(thirdSplits[0].percentage).to.equal(34000);
		expect(thirdSplits[1].name).to.equal("Account 1");
		expect(thirdSplits[1].account).to.equal(this.secondAccount.address);
		expect(thirdSplits[1].percentage).to.equal(33000);
		expect(thirdSplits[2].name).to.equal("Account 2");
		expect(thirdSplits[2].account).to.equal(this.thirdAccount.address);
		expect(thirdSplits[2].percentage).to.equal(33000);
		expect(thirdSplits.length).to.equal(3);
	});

	it("can reconfigure capped splits correctly", async function () {
		await this.cappedRevenueShare.connect(this.owner).initialize({
			contractName: "Valid Initializer",
			cappedSplits: getCappedSplits.call(
				this,
				["0", "3", "10"],
				[[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
			),
		}, this.owner.address, true);

		let initialCappedSplits = await this.cappedRevenueShare.getCappedSplits();

		await this.cappedRevenueShare.connect(this.owner).reconfigureCappedSplits(getCappedSplits.call(
			this,
			["0"],
			[[100000]]
		));

		let reconfiguredCappedSplits = await this.cappedRevenueShare.getCappedSplits();

		expect(initialCappedSplits.length).to.equal(3);
		expect(reconfiguredCappedSplits.length).to.equal(1);

		expect(reconfiguredCappedSplits[0].cap).to.equal(0n);
		expect(reconfiguredCappedSplits[0].splits.length).to.equal(1);
		expect(reconfiguredCappedSplits[0].splits[0].name).to.equal("Account 0");
		expect(reconfiguredCappedSplits[0].splits[0].account).to.equal(this.firstAccount.address);
		expect(reconfiguredCappedSplits[0].splits[0].percentage).to.equal(100000);
	});

	it("sets contract name correctly", async function () {
		await this.cappedRevenueShare.initialize({
			contractName: "Valid Initializer",
			cappedSplits: getCappedSplits.call(this, ["0"], [[100000]]),
		}, this.owner.address, false);

		let contractName = await this.cappedRevenueShare.contractName();
		expect(contractName).to.equal("Valid Initializer");
	});

	it("sets owner correctly", async function () {
		await this.cappedRevenueShare.initialize({
			contractName: "Valid Initializer",
			cappedSplits: getCappedSplits.call(this, ["0"], [[100000]]),
		}, this.owner.address, false);

		let owner = await this.cappedRevenueShare.owner();
		expect(owner).to.equal(this.owner.address);
	});

	it("pays out fractional splits", async function () {
		await this.cappedRevenueShare.initialize({
			contractName: "Valid Initializer",
			cappedSplits: getCappedSplits.call(this, ["0"], [[33333, 33333, 33334]]),
		}, this.owner.address, false);

		await checkBalances.call(this, ["0", "10000", "10000", "10000"]);

		await sendETH.call(this, "5");

		await checkBalance(this.cappedRevenueShare.address, 0n);
		await checkBalance(this.signers[1].address, 10001666650000000000000n);
		await checkBalance(this.signers[2].address, 10001666650000000000000n);
		await checkBalance(this.signers[3].address, 10001666700000000000000n);
	});

	it("pays out a split before the first cap", async function () {
		await this.cappedRevenueShare.initialize({
			contractName: "Valid Initializer",
			cappedSplits: getCappedSplits.call(
				this,
				["0", "100"],
				[[100000], [80000, 20000]]
			),
		}, this.owner.address, false);

		await checkBalances.call(this, ["0", "10000", "10000"]);

		await sendETH.call(this, "5");

		await checkBalances.call(this, ["0", "10005", "10000"]);
	});

	it("pays out a split in between caps", async function () {
		await this.cappedRevenueShare.initialize({
			contractName: "Valid Initializer",
			cappedSplits: getCappedSplits.call(
				this,
				["0", "10", "20"],
				[[100000], [80000, 20000], [50000, 50000]]
			),
		}, this.owner.address, false);

		await sendETH.call(this, "10");

		await checkBalances.call(this, ["0", "10010", "10000"]);

		await sendETH.call(this, "10");

		await checkBalances.call(this, ["0", "10018", "10002"]);
	});

	it("pays out a split after the last cap", async function () {
		await this.cappedRevenueShare.initialize({
			contractName: "Valid Initializer",
			cappedSplits: getCappedSplits.call(
				this,
				["0", "10", "20"],
				[[100000], [80000, 20000], [50000, 50000]]
			),
		}, this.owner.address, false);

		await sendETH.call(this, "20");

		await checkBalances.call(this, ["0", "10018", "10002"]);

		await sendETH.call(this, "10");

		await checkBalances.call(this, ["0", "10023", "10007"]);
	});

	it("pays out multiple splits before and after first cap", async function () {
		await this.cappedRevenueShare.initialize({
			contractName: "Valid Initializer",
			cappedSplits: getCappedSplits.call(
				this,
				["0", "100", "200"],
				[[100000], [80000, 20000], [20000, 30000, 50000]]
			),
		}, this.owner.address, false);

		await checkBalances.call(this, ["0", "10000", "10000", "10000"]);

		await sendETH.call(this, "150");

		await checkBalances.call(this, ["0", "10140", "10010"]);
	});

	it("pays out multiple splits before and after last cap", async function () {
		await this.cappedRevenueShare.initialize({
			contractName: "Valid Initializer",
			cappedSplits: getCappedSplits.call(
				this,
				["0", "100", "200"],
				[[100000], [80000, 20000], [20000, 30000, 50000]]
			),
		}, this.owner.address, false);

		await sendETH.call(this, "150");

		await checkBalances.call(this, ["0", "10140", "10010", "10000"]);

		await sendETH.call(this, "150");

		await checkBalances.call(this, ["0", "10200", "10050", "10050"]);
	});

	it("pays out multiple splits before, after, and between two caps", async function () {
		await this.cappedRevenueShare.initialize({
			contractName: "Valid Initializer",
			cappedSplits: getCappedSplits.call(
				this,
				["0", "100", "200"],
				[[100000], [80000, 20000], [20000, 30000, 50000]]
			),
		}, this.owner.address, false);

		await checkBalances.call(this, ["0", "10000", "10000", "10000"]);

		await sendETH.call(this, "300");

		await checkBalances.call(this, ["0", "10200", "10050", "10050"]);
	});

	it("emits withdraw events correctly", async function () {
		await this.cappedRevenueShare.initialize({
			contractName: "Valid Initializer",
			cappedSplits: getCappedSplits.call(
				this,
				["0", "100", "200"],
				[[100000], [80000, 20000], [20000, 30000, 50000]]
			),
		}, this.owner.address, false);

		await sendETH.call(this, "300");

		let events = await getLogs(this.cappedRevenueShare.address);

		expect(events.length).to.equal(3);
		expect(events[0].amount).to.equal(200000000000000000000n);
		expect(events[0].account).to.equal(this.firstAccount.address);

		expect(events[1].amount).to.equal(50000000000000000000n);
		expect(events[1].account).to.equal(this.secondAccount.address);

		expect(events[2].amount).to.equal(50000000000000000000n);
		expect(events[2].account).to.equal(this.thirdAccount.address);

		expect(events[0].timestamp).to.equal(events[1].timestamp);
		expect(events[1].timestamp).to.equal(events[2].timestamp);
	});

	// sends a given amount of eth to the capped revenue share contract address
	async function sendETH(this: Mocha.Context, eth: string) {
		await this.moneySender.sendTransaction({
			to: this.cappedRevenueShare.address,
			value: ethers.utils.parseEther(eth),
		});
	}

	// returns an array of capped splits with given caps and split percentages
	function getCappedSplits(
		this: Mocha.Context,
		caps: string[],
		splits: number[][]
	): { cap: bigint; splits: { account: string; percentage: number }[] }[] {
		let cappedSplits = [];

		for (let i = 0; i < caps.length; i++) {
			cappedSplits.push({
				cap: ethers.utils.parseEther(caps[i]).toBigInt(),
				splits: getSplits.call(this, splits[i]),
			});
		}

		return cappedSplits;
	}

	// returns an array of splits with given percentages. Accounts are assigned in sequence starting from signers[1].
	function getSplits(
		this: Mocha.Context,
		percentages: number[]
	): { account: string; percentage: number }[] {
		let splits = [];

		for (let i = 0; i < percentages.length; i++) {
			splits.push({
				name: "Account " + i,
				account: this.signers[i + 1].address,
				percentage: percentages[i],
			});
		}
		return splits;
	}

	// helper function to check balances for the capped revenue share contract + signer addresses
	async function checkBalances(
		this: Mocha.Context,
		expectedBalances: string[]
	): Promise<void> {
		for (let i = 0; i < expectedBalances.length; i++) {
			if (i == 0)
				await checkBalance(
					this.cappedRevenueShare.address,
					ethers.utils.parseEther(expectedBalances[0]).toBigInt()
				);
			else
				await checkBalance(
					this.signers[i].address,
					ethers.utils.parseEther(expectedBalances[i]).toBigInt()
				);
		}
	}

	// helper function to check the node balance
	async function checkBalance(
		address: any,
		expectedBalance: bigint
	): Promise<void> {
		let balance = await ethers.provider.getBalance(address);
		expect(balance).to.equal(expectedBalance);
	}

	const getLogs = async (address: string) => {
		let cappedRevShareABI = require(path.resolve(__dirname, "../../abi/contracts/CappedRevenueShare/CappedRevenueShare.sol/CappedRevenueShare.json"))
		let contractInterface = new ethers.utils.Interface(cappedRevShareABI)
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
});
