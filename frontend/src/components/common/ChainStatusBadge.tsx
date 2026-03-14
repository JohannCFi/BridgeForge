import { useChainStatus } from "../../api/hooks";
import type { Chain } from "../../types";

interface Props {
  chain: Chain;
}

export function ChainStatusBadge({ chain }: Props) {
  const { data: status } = useChainStatus();
  const isHealthy = status?.[chain] ?? true;

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${isHealthy ? "bg-emerald-400" : "bg-red-400"}`}
      title={isHealthy ? `${chain} is online` : `${chain} is offline`}
    />
  );
}
