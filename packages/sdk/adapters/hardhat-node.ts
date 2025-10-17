import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { createConnection } from 'net';

const sleep = promisify(setTimeout);

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const connection = createConnection({ port, host: '127.0.0.1' });

    connection.on('connect', () => {
      connection.destroy();
      resolve(false); // Port is in use
    });

    connection.on('error', () => {
      resolve(true); // Port is available
    });
  });
}

async function testHardhatNode(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { result: string };
      // Check if it returns Hardhat's chain ID (31337 = 0x7a69)
      return data.result === '0x7a69';
    }
    return false;
  } catch {
    return false;
  }
}

export class HardhatNode {
  private process: ChildProcess | null = null;
  private isReady = false;

  async start(): Promise<void> {
    if (this.process) {
      return; // Already started
    }

    // Check if port 8545 is already in use
    const portAvailable = await isPortAvailable(8545);
    if (!portAvailable) {
      // Port is in use, check if it's a Hardhat node we can use
      const isHardhatNode = await testHardhatNode(8545);
      if (isHardhatNode) {
        console.log('Found existing Hardhat node on port 8545, using it...');
        this.isReady = true;
        return; // Use the existing node
      } else {
        throw new Error('Port 8545 is in use by a non-Hardhat service. Please free the port.');
      }
    }

    console.log('Starting Hardhat node...');

    this.process = spawn('npx', ['hardhat', 'node'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Wait for the node to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Hardhat node failed to start within 30 seconds'));
      }, 30000);

      const onData = (data: Buffer) => {
        const output = data.toString();
        if (output.includes('Started HTTP and WebSocket JSON-RPC server at')) {
          clearTimeout(timeout);
          this.isReady = true;
          console.log('Hardhat node is ready!');
          resolve();
        }
      };

      this.process!.stdout?.on('data', onData);
      this.process!.stderr?.on('data', onData);

      this.process!.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.process!.on('exit', (code) => {
        if (code !== 0 && !this.isReady) {
          clearTimeout(timeout);
          reject(new Error(`Hardhat node exited with code ${code}`));
        }
      });
    });

    // Give it a bit more time to be fully ready
    await sleep(2000);
  }

  async stop(): Promise<void> {
    if (this.process) {
      console.log('Stopping Hardhat node...');

      try {
        // Immediately force kill - no graceful shutdown to avoid hanging
        this.process.kill('SIGKILL');
        this.process = null;
        this.isReady = false;

        // Quick port cleanup
        await this.killProcessOnPort(8545);

        console.log('Hardhat node stopped');
      } catch (error) {
        console.log('Error stopping node:', error);
        // Force cleanup regardless
        this.process = null;
        this.isReady = false;
        await this.killProcessOnPort(8545);
      }
    } else if (this.isReady) {
      // We're using an existing node, just mark as not ready
      console.log('Using external Hardhat node, not stopping it...');
      this.isReady = false;
    }
  }

  isRunning(): boolean {
    return this.process !== null && this.isReady;
  }

  private async killProcessOnPort(port: number): Promise<void> {
    try {
      const { spawn } = await import('child_process');

      // Kill any process using the port (Linux/macOS) - faster timeout
      const killProcess = spawn('sh', ['-c', `lsof -ti :${port} | xargs -r kill -9`], {
        stdio: 'ignore',
      });

      await new Promise<void>((resolve) => {
        killProcess.on('exit', () => resolve());
        killProcess.on('error', () => resolve()); // Ignore errors
        setTimeout(resolve, 300); // Shorter timeout - 300ms
      });
    } catch {
      // Ignore errors - this is a cleanup attempt
    }
  }
}

// Global instance
export const hardhatNode = new HardhatNode();

// Global instance - no process handlers to avoid interfering with test process
