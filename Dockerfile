FROM ruby:3.3-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

ENV GEM_HOME=/usr/local/bundle \
    BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_BIN=/usr/local/bundle/bin \
    BUNDLE_APP_CONFIG=/usr/local/bundle/config \
    BUNDLE_JOBS=4 \
    BUNDLE_RETRY=3

COPY scripts/docker-jekyll-serve.sh /usr/local/bin/docker-jekyll-serve
RUN chmod +x /usr/local/bin/docker-jekyll-serve

EXPOSE 4000 35729

CMD ["docker-jekyll-serve"]
