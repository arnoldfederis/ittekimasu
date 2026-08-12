#!/bin/bash

arg_packages="$@"
arg_app=${@: -1}

cd $arg_app && bun add ${@:1:$#-1}
exit 0