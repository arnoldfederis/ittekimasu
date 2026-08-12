#!/bin/bash

echo "Removing /etc/hosts"

# Try to run 'hostctl' in case it is not installed in host
if ! sudo hostctl &> /dev/null; then
  echo "Error: 'hostctl' command is not installed in host."
  exit 1
fi

sudo hostctl remove
sudo hostctl list
