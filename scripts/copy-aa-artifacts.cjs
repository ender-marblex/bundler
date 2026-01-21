/**
 * Copy artifacts from submodules/account-abstraction/artifacts/contracts
 * to submodules/account-abstraction/contracts/artifacts/
 * so that @account-abstraction/contracts/artifacts/*.json can be resolved.
 * Excludes: test, Test, dbg, bls, IOracle, v06 (same as prepack-contracts-package.sh)
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const srcDir = path.join(root, 'submodules', 'account-abstraction', 'artifacts', 'contracts')
const destDir = path.join(root, 'submodules', 'account-abstraction', 'contracts', 'artifacts')

const excludeRe = /test|Test|dbg|bls|IOracle|v06/

function findJsonFiles (dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel = path.relative(srcDir, full)
    if (excludeRe.test(rel)) continue
    const st = fs.statSync(full)
    if (st.isDirectory()) {
      findJsonFiles(full, files)
    } else if (name.endsWith('.json')) {
      files.push(full)
    }
  }
  return files
}

if (!fs.existsSync(srcDir)) {
  console.error('copy-aa-artifacts: source not found:', srcDir)
  console.error('Run: cd submodules/account-abstraction && npx hardhat compile')
  process.exit(1)
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true })
}

const toCopy = findJsonFiles(srcDir)
for (const src of toCopy) {
  const name = path.basename(src)
  const dest = path.join(destDir, name)
  fs.copyFileSync(src, dest)
  console.log('  copied', name)
}

console.log('copy-aa-artifacts: done,', toCopy.length, 'files')
