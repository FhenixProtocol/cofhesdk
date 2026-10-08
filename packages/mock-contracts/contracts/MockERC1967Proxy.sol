// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

import { ERC1967Proxy } from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';

/**
 * @notice OpenZeppelin's ERC-1967 proxy under a name of its own (no clash with a project's own
 * `ERC1967Proxy` artifact). The ACP share registry is the production contract, which refuses to
 * be initialized directly, so the mocks deploy it behind this proxy as production does.
 */
contract MockERC1967Proxy is ERC1967Proxy {
  constructor(address implementation, bytes memory data) payable ERC1967Proxy(implementation, data) {}
}
