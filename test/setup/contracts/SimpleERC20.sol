// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/**
 * Minimal ERC20-shaped fixture (no transfers needed): public `balanceOf` /
 * `allowance` mappings plus `mint` and `approve`. Used by the react hooks'
 * token-balance/allowance invalidation tests — proving that both reads, now
 * keyed under the standard cofheReadContract grammar, refresh from ordinary
 * invalidation descriptors.
 */
contract SimpleERC20 {
  string public name = 'Simple';
  string public symbol = 'SIM';
  uint8 public decimals = 6;

  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);

  function mint(address to, uint256 amount) external {
    balanceOf[to] += amount;
    emit Transfer(address(0), to, amount);
  }

  function approve(address spender, uint256 amount) external returns (bool) {
    allowance[msg.sender][spender] = amount;
    emit Approval(msg.sender, spender, amount);
    return true;
  }
}
