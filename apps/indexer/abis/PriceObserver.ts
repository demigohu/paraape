import { parseAbi } from "viem";

export const PriceObserverAbi = parseAbi([
  "event Recorded(bytes32 indexed poolRef, uint16 index, int24 tick, uint32 timestamp, uint32 blockNumber)",
  "function cardinality(bytes32 poolRef) view returns (uint16)",
  "function lastRecordTime(bytes32 poolRef) view returns (uint32)",
  "function minRecordInterval() view returns (uint32)",
]);
