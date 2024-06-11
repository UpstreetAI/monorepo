#!/bin/bash

# get the dir of the currently executing script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# get the node_modules
NODE_MODULES="$DIR/../lib/node_modules"

# get the upstreet-sdk
USDK="$NODE_MODULES/usdk"

# use presence of the cli.mjs to determine if we are running local dev or the published module
CLI="$USDK/cli.js"
if [ -f "$CLI" ]; then
  # XXX this is ideally running through esbuild watch mode
  # however, for that to work, we would need to fork and listen for esbuild startup to complete on stdout
  # i.e. something like:
  #   esbuild --watch > esbuild_output.log 2>&1 &
  #   ESBUILD_PID=$!
  #   tail -f esbuild_output.log | grep --line-buffered -m 1 "Watcher is ready" &
  #   wait $!

  # echo "TSX: $TSX"
  node "$CLI" "$@"
else
  echo "running from installed dist"
  DIST="$USDK/dist"
  node "$DIST/bundle.cjs" "$@"
fi
