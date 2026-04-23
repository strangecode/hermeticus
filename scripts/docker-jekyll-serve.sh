#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: docker-jekyll-serve

Start the local Jekyll server with host-accessible preview ports. Rebuild the
Docker image after changing Gemfile or Gemfile.lock.
EOF
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

exec bundle exec jekyll serve \
  --host 0.0.0.0 \
  --port "${JEKYLL_PORT:-4000}" \
  --force_polling
