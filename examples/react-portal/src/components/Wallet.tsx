import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { useChains } from 'wagmi';
// import { formatAddress } from './utils'; // optional helper

export function Wallet() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending: isConnecting, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { chains, switchChain, isPending: isSwitching } = useSwitchChain();
  const available = useChains() ?? chains;

  // console.log('connectors', connectors);
  if (!isConnected) {
    return (
      <div>
        {connectors.map((c) => (
          <button key={c.uid} onClick={() => connect({ connector: c })} disabled={isConnecting}>
            Connect {c.name}
            {/* {!c.ready ? ' (unavailable)' : ''} */}
          </button>
        ))}
        {error && <p>Failed: {error.message}</p>}
      </div>
    );
  }

  return (
    <div>
      <div>Connected: {address}</div>
      <div>
        {available.map((ch) => (
          <button key={ch.id} onClick={() => switchChain({ chainId: ch.id })} disabled={isSwitching}>
            Switch to {ch.name}
          </button>
        ))}
      </div>
      <button onClick={() => disconnect()}>Disconnect</button>
    </div>
  );
}
