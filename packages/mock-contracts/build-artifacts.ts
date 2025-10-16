import { execSync } from 'node:child_process';
import fs from 'node:fs';

const contracts = ['MockTaskManager', 'MockACL', 'MockZkVerifier', 'MockQueryDecrypter', 'TestBed'];

function inspect(contract: string, field: string): any {
  const cmd = `forge inspect ${contract} ${field} --json`;
  const out = execSync(cmd, { encoding: 'utf8' }).trim();

  if (field === 'bytecode' || field === 'deployedBytecode') {
    // Both are emitted as quoted strings (JSON-encoded)
    return out.toLowerCase();
  }

  // ABI and metadata are full JSON
  return JSON.parse(out);
}

for (const name of contracts) {
  const abi = inspect(name, 'abi');
  const bytecode = inspect(name, 'bytecode');
  const deployedBytecode = inspect(name, 'deployedBytecode');
  const metadata = inspect(name, 'metadata');

  const artifact = {
    contractName: name,
    abi,
    bytecode,
    deployedBytecode,
    metadata,
  };

  fs.writeFileSync(`dist/artifacts/${name}.json`, JSON.stringify(artifact, null, 2));
}
