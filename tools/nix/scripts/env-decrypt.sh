#!/bin/bash

export SOPS_AGE_KEY_FILE="./tools/secrets/age.key"
SECRETS_DIR=./tools/secrets

# get all files that ends with .sops.yaml
FILES=$(find $SECRETS_DIR -type f -name "*.sops.yaml")

for FILE in $FILES
do
  # get the filename without the .local.yaml extension
  FILENAME=$(basename "$FILE" .sops.yaml)

  # decrypt wit sops and save it as $FILENAME.sops.yaml
  sops --decrypt $FILE > "$SECRETS_DIR/$FILENAME.local.yaml"
  echo "Decrypted $FILENAME.sops.yaml"
done
