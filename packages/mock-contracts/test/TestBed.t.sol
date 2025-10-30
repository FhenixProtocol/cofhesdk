// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Test } from 'forge-std/Test.sol';
import { TestBed } from '../contracts/TestBed.sol';
import { CoFheTest } from '../contracts/foundry/CoFheTest.sol';
import { FHE, InEuint32, euint8, euint256 } from '../contracts/cofhe/FHE.sol';
import { Permission } from '../contracts/Permissioned.sol';
import { FunctionId } from '../contracts/cofhe/ICofhe.sol';

contract TestBedTest is Test, CoFheTest {
  TestBed private testbed;

  uint256 private privateKey = 0x111122223333444455556666777788889999AAAABBBBCCCCDDDDEEEEFFFF0000;
  address private user = vm.addr(privateKey);

  function setUp() public {
    // optional ... enable verbose logging from fhe mocks
    // setLog(true);

    testbed = new TestBed();
  }

  function testSetNumberFuzz(uint32 n) public {
    InEuint32 memory number = createInEuint32(n, user);

    //must be the user who sends transaction
    //or else invalid permissions from fhe allow
    vm.prank(user);
    testbed.setNumber(number);

    assertHashValue(testbed.eNumber(), n);
  }

  function testOverflow() public {
    euint8 a = FHE.asEuint8(240);
    euint8 b = FHE.asEuint8(240);
    euint8 c = FHE.add(a, b);

    assertHashValue(euint8.unwrap(c), (240 + 240) % 256);
  }

  function testDivideByZero() public {
    euint8 a = FHE.asEuint8(240);
    euint8 b = FHE.asEuint8(0);
    euint8 c = FHE.div(a, b);

    assertHashValue(euint8.unwrap(c), type(uint8).max);
  }

  function test256BitsNoOverflow() public {
    euint256 a = FHE.asEuint256(type(uint256).max);
    euint256 b = FHE.asEuint256(type(uint256).max);
    euint256 c = FHE.add(a, b);

    uint256 expected;
    unchecked {
      expected = type(uint256).max + type(uint256).max;
    }

    assertHashValue(euint256.unwrap(c), expected);
  }

  function testAttestation() public {
    uint8 lhs = 10;
    euint8 rhs = FHE.asEuint8(10);

    Permission memory permission = createPermissionSelf(user);
    permission = signPermissionSelf(permission, privateKey);

    (bool success, bytes memory proof) = mockAttester.attestPlaintextEncrypted(
      lhs,
      euint8.unwrap(rhs),
      FunctionId.eq,
      permission
    );
    assertTrue(success);

    bool isValid = mockAttester.validateAttestation(lhs, euint8.unwrap(rhs), FunctionId.eq, proof);
    assertTrue(isValid);

    isValid = FHE.checkEqProof(lhs, euint8.unwrap(rhs), proof);
    assertTrue(isValid);
  }
}
