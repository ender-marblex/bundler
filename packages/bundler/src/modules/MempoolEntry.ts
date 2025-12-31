import { BigNumber, BigNumberish } from 'ethers'
import { OperationBase, ReferencedCodeHashes, UserOperation } from '@account-abstraction/utils'

export class MempoolEntry {
  userOpMaxGas: BigNumber

  constructor (
    readonly userOp: OperationBase,
    readonly userOpHash: string,
    readonly prefund: BigNumberish,
    readonly referencedContracts: ReferencedCodeHashes,
    readonly skipValidation: boolean,
    readonly aggregator?: string
  ) {
    const op = this.userOp as UserOperation
    const preVerificationGas = op.preVerificationGas ?? 0
    const callGasLimit = op.callGasLimit ?? 0
    const verificationGasLimit = op.verificationGasLimit ?? 0
    const paymasterVerificationGasLimit = op.paymasterVerificationGasLimit ?? 0
    const paymasterPostOpGasLimit = op.paymasterPostOpGasLimit ?? 0
    
    if (preVerificationGas === undefined || callGasLimit === undefined || verificationGasLimit === undefined) {
      throw new Error(`MempoolEntry: missing required gas fields - preVerificationGas: ${preVerificationGas}, callGasLimit: ${callGasLimit}, verificationGasLimit: ${verificationGasLimit}`)
    }
    
    this.userOpMaxGas = BigNumber
      .from(preVerificationGas)
      .add(callGasLimit)
      .add(verificationGasLimit)
      .add(paymasterVerificationGasLimit)
      .add(paymasterPostOpGasLimit)
  }
}
