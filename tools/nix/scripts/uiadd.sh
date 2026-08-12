#!/bin/bash

arg_packages="$@"
arg_app=${@: -1}

cd $arg_app && bunx --bun shadcn@latest add ${@:1:$#-1}
exit 0