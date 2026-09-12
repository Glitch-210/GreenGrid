import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying EnergyCredit with operator:", deployer.address);

  const factory = await ethers.getContractFactory("EnergyCredit");
  const contract = await factory.deploy(deployer.address);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("EnergyCredit deployed to:", address);
  console.log("Set SMART_CONTRACT_ADDRESS=" + address + " in apps/api/.env");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
