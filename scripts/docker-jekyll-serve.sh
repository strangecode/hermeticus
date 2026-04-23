#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: docker-jekyll-serve

Install bundle dependencies into the container-managed bundle volume and start
the local Jekyll server with host-accessible preview and livereload ports.
EOF
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

bundle install

exec bundle exec jekyll serve \
  --host 0.0.0.0 \
  --port "${JEKYLL_PORT:-4000}" \
  --livereload \
  --livereload-port "${JEKYLL_LIVERELOAD_PORT:-35729}" \
  --force_polling
