#!/bin/bash

export SOPS_AGE_KEY_FILE="./tools/secrets/age.key"
SECRETS_DIR=./tools/secrets

# check if the secrets directory exists
if [ ! -d "$SECRETS_DIR" ]; then
  echo "The secrets directory does not exist. Please create it first."
  exit 1
fi

# get all files that end with .local.yaml
FILES=$(find $SECRETS_DIR -type f -name "*.local.yaml")

for FILE in $FILES
do
  # get the filename without the .local.yaml extension
  FILENAME=$(basename "$FILE" .local.yaml)

  echo "Processing file: $FILE"

  # extract all the keys in the 'data' field
  KEYS=$(yq ".data | keys" "$FILE" | tr -d '[],"' | tr '\n' ' ')

  # convert KEYS into an array
  IFS=' ' read -r -a keys_array <<< "$KEYS"

  # iterate over each key in the 'data' field
  for key in "${keys_array[@]}"; do
    # extract the value for the key, removing quotes with sed but keeping \n intact
    VALUE=$(yq ".data[\"$key\"]" "$FILE" | sed 's/^"//; s/"$//; s/\\n/\n/g; s/\\//g')

    # create the directory structure based on the key (file path)
    DIR=$(dirname "$key")
    mkdir -p "$DIR"

    # write the cleaned value to the appropriate file path using printf to preserve multiline
    printf "%b" "$VALUE" > "$key"

    echo "Written data to $key"
  done
done
