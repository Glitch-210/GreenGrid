import { ethers } from "hardhat";

/**
 * Pre-demo readiness check. Catches the two failures that only show up on stage:
 * an operator wallet with no gas, and an API key that is not the contract's
 * operator (every mint/transfer/retire would revert with "caller is not the
 * operator").
 *
 *   SMART_CONTRACT_ADDRESS=0x… npx hardhat run scripts/check-deploy.ts --network amoy
 */
async function main() {
  const address = process.env.SMART_CONTRACT_ADDRESS;
  if (!address) throw new Error("SMART_CONTRACT_ADDRESS is not set");

  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No signer — BLOCKCHAIN_PRIVATE_KEY is not set");

  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(signer.address);

  const contract = await ethers.getContractAt("EnergyCredit", address);
  const operator: string = await contract.operator();

  console.log("Network:          ", network.name, `(chainId ${network.chainId})`);
  console.log("Contract:         ", address);
  console.log("Signer:           ", signer.address);
  console.log("Signer balance:   ", ethers.formatEther(balance), "POL");
  console.log("Contract operator:", operator);

  const isOperator = operator.toLowerCase() === signer.address.toLowerCase();
  const funded = balance > 0n;

  console.log("");
  console.log(isOperator ? "OK   signer is the operator" : "FAIL signer is NOT the operator — every write will revert");
  console.log(funded ? "OK   signer has gas" : "FAIL signer has no POL — fund it from the Amoy faucet");

  if (!isOperator || !funded) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
