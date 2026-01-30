/**
 * EIP-7702 authorization helpers (standalone, no Hardhat dependency).
 * See https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7702.md
 * authority = ecrecover(keccak(MAGIC || rlp([chain_id, address, nonce])), y_parity, r, s)
 */

import { ecsign, toBuffer } from 'ethereumjs-util'
import { BigNumber, BigNumberish, Wallet } from 'ethers'
import { arrayify, hexConcat, hexlify, keccak256, RLP } from 'ethers/lib/utils'
import type { EIP7702Authorization } from '@account-abstraction/utils'

const EIP7702_MAGIC = '0x05'

export interface UnsignedEIP7702Authorization {
  chainId: BigNumberish
  address: string
  nonce?: BigNumberish
}

function toRlpHex (s: any): string {
  if (BigNumber.isBigNumber(s) || typeof s === 'number') {
    s = BigNumber.from(s).toHexString()
  }
  let ret = String(s).replace(/0x0*/, '0x')
  if (ret.length % 2 === 1) {
    ret = ret.replace('0x', '0x0')
  }
  return ret
}

function gethHex (n: BigNumberish): string {
  return BigNumber.from(n).toHexString().replace(/0x0(.)/, '0x$1')
}

function eip7702DataToSign (authorization: UnsignedEIP7702Authorization): string {
  const rlpData = [
    toRlpHex(authorization.chainId),
    toRlpHex(authorization.address),
    toRlpHex(authorization.nonce)
  ]
  return keccak256(hexConcat([EIP7702_MAGIC, RLP.encode(rlpData)]))
}

/** Sign EIP-7702 authorization; returns shape compatible with utils EIP7702Authorization. */
export async function signEip7702Authorization (
  signer: Wallet,
  authorization: UnsignedEIP7702Authorization
): Promise<EIP7702Authorization> {
  const nonce = authorization.nonce ?? await signer.getTransactionCount()
  const dataToSign = toBuffer(eip7702DataToSign({ nonce, ...authorization }))
  const sig = ecsign(dataToSign, arrayify(signer.privateKey) as Buffer)
  return {
    address: authorization.address,
    chainId: gethHex(authorization.chainId),
    nonce: gethHex(nonce),
    yParity: gethHex(sig.v - 27),
    r: gethHex(sig.r),
    s: gethHex(sig.s)
  }
}
