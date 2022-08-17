import { ethers, upgrades } from "hardhat";

async function main() {
    let splits = [
        {
            name: "Nik",
            account: "0x99BB44964caEb93bC862a60b89173b934d99bAE7",
            percentage: 50000
        },
        {
            name: "Adam",
            account: "0x12Af066903A962a75959cC915A45Aed26D8DFa44",
            percentage: 50000
        }
    ];

    createSimpleRevenueShare("Calica Revenue Split", splits);
}

async function createSimpleRevenueShare(contractName: string, splits: any) {
    let contractFactory = await ethers.getContractFactory("RevenueShareFactory");
    let contract = contractFactory.attach(process.env["TESTNET_REVENUE_SHARE_FACTORY_ADDRESS"] as string);

    let input = {
        contractName,
        splits
    }

    console.log(input);

    contract.createNewRevenueShare(input);

}

async function createCappedRevenueShare(name: string, cappedSplits: any) {
    let contractFactory = await ethers.getContractFactory("CappedRevenueShareFactory");
    let contract = contractFactory.attach(process.env["TESTNET_CAPPED_REVENUE_SHARE_FACTORY_ADDRESS"] as string);
}

// Allows using async/await everywhere and properly handling errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
