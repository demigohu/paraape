import { parseAbi } from "viem";

export const InsuranceVaultAbi = parseAbi([
  "event CellDeposit(address indexed lp, bytes32 indexed cellKey, uint256 assets, uint256 shares)",
  "event CellWithdraw(address indexed lp, bytes32 indexed cellKey, uint256 assets, uint256 shares)",
  "event PolicyPurchased(uint256 indexed policyId, address indexed buyer, uint8 severityIdx, uint8 durationIdx, uint256 coverageUsdg, uint256 premiumUsdg)",
  "event PolicySettled(uint256 indexed policyId, uint256 payout, uint256 challengeDeadline)",
  "event PolicyChallenged(uint256 indexed policyId, address indexed challenger, uint256 bond)",
  "event ChallengeRejected(uint256 indexed policyId, address indexed challenger, uint256 fee)",
  "event PolicyReleased(uint256 indexed policyId, uint256 payout)",
  "event PolicyVoided(uint256 indexed policyId)",
  "event PolicyExpired(uint256 indexed policyId)",
  "event RecordBountyPaid(address indexed recorder, uint256 amount)",
  "function poolRef() view returns (bytes32)",
  "function insuredToken() view returns (address)",
  "function cells(bytes32 key) view returns (uint256 totalAssets, uint256 lockedAssets, uint256 totalShares)",
  "function observer() view returns (address)",
  "function riskEngine() view returns (address)",
]);
