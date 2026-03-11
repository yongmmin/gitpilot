#!/usr/bin/env node

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const bump = process.argv[2] || 'patch'
const allowed = new Set(['patch', 'minor', 'major'])
if (!allowed.has(bump)) {
  console.error(`Invalid bump: ${bump}. Use patch|minor|major.`)
  process.exit(1)
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' })
}

run(`npm version ${bump} --no-git-tag-version`)

const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const vsix = `gitpilot-${pkg.version}.vsix`

run('npm run package')
run(`code --install-extension ${vsix}`)

console.log(`Installed ${vsix}`)
