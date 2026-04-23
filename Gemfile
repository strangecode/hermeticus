source "https://rubygems.org"

# Use the `github-pages` gem so local builds match what GitHub Pages runs.
# This pins Jekyll and the set of allowed plugins to GitHub Pages' versions.
# See https://pages.github.com/versions/ for the current pin.
gem "github-pages", group: :jekyll_plugins

# Platform-specific gems required by Jekyll on some hosts.
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]

gem "csv", "~> 3.3"

gem "bigdecimal", "~> 4.1"
