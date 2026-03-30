#!/usr/bin/env bash

set -euo pipefail

NODE_MAJOR_VERSION="${NODE_MAJOR_VERSION:-20}"
INSTALL_CODEX="${INSTALL_CODEX:-1}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

log() {
  printf '\n[%s] %s\n' "setup-wsl-dev" "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

ensure_apt_packages() {
  require_command sudo
  require_command apt

  log "Installing base Ubuntu packages"
  sudo apt update
  sudo apt install -y curl git build-essential
}

install_nvm_if_needed() {
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    log "Installing nvm"
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
  fi
}

load_nvm() {
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
}

ensure_node() {
  install_nvm_if_needed
  load_nvm

  log "Installing Node.js ${NODE_MAJOR_VERSION}"
  nvm install "$NODE_MAJOR_VERSION"
  nvm use "$NODE_MAJOR_VERSION"
  nvm alias default "$NODE_MAJOR_VERSION" >/dev/null
}

install_codex_if_enabled() {
  if [ "$INSTALL_CODEX" != "1" ]; then
    log "Skipping codex installation"
    return
  fi

  log "Installing @openai/codex globally"
  npm install -g @openai/codex
}

install_project_dependencies() {
  log "Installing project dependencies"
  cd "$PROJECT_ROOT"
  npm install
}

print_versions() {
  log "Installed versions"
  node -v
  npm -v
  git --version

  if command -v codex >/dev/null 2>&1; then
    codex --version
  fi
}

main() {
  ensure_apt_packages
  ensure_node
  install_codex_if_enabled
  install_project_dependencies
  print_versions

  log "Setup complete"
  printf 'Run: cd "%s" && npm run start:dev\n' "$PROJECT_ROOT"
}

main "$@"
