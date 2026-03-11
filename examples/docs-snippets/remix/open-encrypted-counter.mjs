import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function execOrNull(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return (result.stdout || '').trim() || null;
}

function parseGitHubRemote(remoteUrl) {
  if (!remoteUrl) return null;
  // git@github.com:Owner/Repo.git
  const sshMatch = remoteUrl.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  // https://github.com/Owner/Repo.git
  const httpsMatch = remoteUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };

  return null;
}

function openUrl(url) {
  const platform = process.platform;
  if (platform === 'darwin') return spawnSync('open', [url], { stdio: 'inherit' });
  if (platform === 'win32') return spawnSync('cmd', ['/c', 'start', '', url], { stdio: 'inherit' });
  return spawnSync('xdg-open', [url], { stdio: 'inherit' });
}

const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const repoRoot = resolve(here, '../../../');

const contractFilePath = resolve(repoRoot, 'examples/docs-snippets/remix/EncryptedCounter.sol');

const args = process.argv.slice(2).filter((a) => a !== '--');
const printOnly = args.includes('--print');
const useLocal = args.includes('--local');
const portArgIndex = args.indexOf('--port');
const portArg = portArgIndex >= 0 ? args[portArgIndex + 1] : null;
const refArgIndex = args.indexOf('--ref');
const refArg = refArgIndex >= 0 ? args[refArgIndex + 1] : null;

function startLocalServer() {
  const content = readFileSync(contractFilePath, 'utf8');
  const preferredPort = portArg ? Number(portArg) : 0;
  if (portArg && (!Number.isFinite(preferredPort) || preferredPort <= 0 || preferredPort > 65535)) {
    throw new Error(`Invalid --port value: ${portArg}`);
  }

  const server = createServer((req, res) => {
    if (!req.url || req.url === '/' || req.url === '/EncryptedCounter.sol') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(content);
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not found');
  });

  return new Promise((resolvePromise, rejectPromise) => {
    server.on('error', rejectPromise);
    server.listen(preferredPort, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        rejectPromise(new Error('Unexpected server address'));
        return;
      }

      const localUrl = `http://127.0.0.1:${addr.port}/EncryptedCounter.sol`;
      resolvePromise({ server, localUrl });
    });
  });
}

async function main() {
  let sourceUrl;
  let keepAliveServer = null;

  if (useLocal) {
    const { server, localUrl } = await startLocalServer();
    keepAliveServer = server;
    sourceUrl = localUrl;
  } else {
    const remoteUrl = execOrNull('git', ['-C', repoRoot, 'config', '--get', 'remote.origin.url']);
    const gh = parseGitHubRemote(remoteUrl);

    const defaultRef = execOrNull('git', ['-C', repoRoot, 'rev-parse', 'HEAD']) ?? 'master';
    const ref = process.env.REMIX_REF ?? refArg ?? defaultRef;

    const pathInRepo = 'examples/docs-snippets/remix/EncryptedCounter.sol';

    if (gh) {
      sourceUrl = `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${ref}/${pathInRepo}`;
    } else {
      sourceUrl = `https://raw.githubusercontent.com/FhenixProtocol/cofhesdk/${ref}/${pathInRepo}`;
    }
  }

  const remixUrl = `https://remix.ethereum.org/#url=${encodeURIComponent(sourceUrl)}`;

  console.log('Remix URL:');
  console.log(remixUrl);
  console.log('');
  console.log('Solidity URL:');
  console.log(sourceUrl);

  if (!printOnly) {
    const result = openUrl(remixUrl);
    if ((result.status ?? 0) !== 0) process.exit(result.status ?? 1);
  }

  if (keepAliveServer) {
    console.log('');
    console.log('Local server running. Keep this process alive while Remix is open.');
    console.log('Press Ctrl+C to stop.');
    await new Promise(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
