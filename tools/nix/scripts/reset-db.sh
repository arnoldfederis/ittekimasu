#!/bin/bash

echo "Removing db..."
rm -rf .devbox/virtenv/postgresql/data
rm .devbox/virtenv/redis/dump.rdb
echo "Done removing db."
