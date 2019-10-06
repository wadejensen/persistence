#!/usr/bin/env bash

set -o errexit
set -o pipefail
set -o nounset

REPO_ROOT="$(git rev-parse --show-toplevel)"

main() {
  cd "${REPO_ROOT}"
  brew install node redis
  npm install
}

main "$@"
