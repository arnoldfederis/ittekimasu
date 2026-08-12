#!/bin/bash

# Generate Age key pair
age-keygen -o tools/secrets/age.key

# Extract public key
PUBLIC_KEY=$(grep "public key:" tools/secrets/age.key | cut -d ":" -f 2 | tr -d ' ')

# Update .sops.yaml with the public key
sed -i.bak "s|AGE-PUBLIC-KEY-PLACEHOLDER|$PUBLIC_KEY|g" .sops.yaml
rm .sops.yaml.bak

echo "Age key pair generated and .sops.yaml updated with public key"
echo "Public key: $PUBLIC_KEY"
echo ""
echo "IMPORTANT: Keep the private key (tools/secrets/age.key) secure and never commit it to version control!"
echo "Add tools/secrets/age.key to .gitignore"
