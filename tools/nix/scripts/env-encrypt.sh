#!/bin/bash

arg_action=$1
actions=("all")

export SOPS_AGE_KEY_FILE="$ROOT_PWD/tools/secrets/age.key"
SECRETS_DIR=./tools/secrets

# check if the secrets directory exists
if [ ! -d "$SECRETS_DIR" ]; then
  echo "The secrets directory does not exist. Please create it first."
  exit 1
fi

FILES=$(find $SECRETS_DIR -type f -name "*.local.yaml")

if [[ -z "$arg_action" ]]; then
	selected=$(printf "$FILES" | sort | fzf --multi --reverse)
elif [[ "$2" == "--help" ]] || ! echo "$actions" | grep -qwb "$arg_action"; then
	echo "Usage: env-encrypt <action>"
	echo ""
	echo "Available actions:"
	echo "all"
	exit 1
else
	selected="$FILES"
fi

if [[ -z "$selected" ]]; then
	exit 1
fi

for FILE in $selected
do
  # get the filename without the .local.yaml extension
  FILENAME=$(basename "$FILE" .local.yaml)

  # encrypt wit sops and save it as $FILENAME.sops.yaml
  sops --encrypt $FILE > "$SECRETS_DIR/$FILENAME.sops.yaml"
  echo "Encrypted $FILENAME.sops.yaml"
done
