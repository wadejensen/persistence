#!/usr/bin/env bash

set -o errexit
set -o pipefail
set -o nounset

REPO_ROOT="$(git rev-parse --show-toplevel)"

main() {
  cd "${REPO_ROOT}"
  redis-cli shutdown || true
  redis-server &
  AWS_PROFILE="wjensen" npm run deploy
}

main "$@"

# Commands:
#     redis-cli FLUSHALL
#     redis-cli keys 'wikipedia*'
#     aws s3 ls --profile wjensen s3://wjensen-wikipedia-store/
#     aws s3 rm --recursive --profile wjensen s3://wjensen-wikipedia-store/
#     curl http://localhost:3000/api/store?query=qut
#     curl http://localhost:3000/api/search?query=qut

