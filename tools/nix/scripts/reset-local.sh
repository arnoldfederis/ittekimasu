#!/bin/bash

echo "Resetting local..."

bun clean
bun install
cert-gen
env-decrypt
env-sync
sync-hosts
dev up