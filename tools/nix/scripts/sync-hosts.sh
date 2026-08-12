#!/bin/bash

echo "Syncing /etc/hosts"

# Try to run 'hostctl' in case it is not installed in host
if ! sudo hostctl &> /dev/null; then
  echo "Error: 'hostctl' command is not installed in host."
  exit 1
fi

sudo hostctl remove ittekimasu --quiet > /dev/null 2>&1
sudo hostctl add ittekimasu --quiet --from ./.etchosts
hostctl list
