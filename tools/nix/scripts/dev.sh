#!/bin/bash

arg_action=$1
arg_app=$2
pc_port=9091

# Define apps and actions
actions=("up" "down" "list" "attach" "start" "restart" "stop" "logs" "run", "install", "rm")

# Function to display usage
usage() {
  echo "Usage: devbox run dev <action> [options]"
  echo ""
  echo "Available actions:"
  echo ""
  echo "  up [mobile]                      Start the development environment."
  echo "                                   mobile - start the mobile"
  echo ""
  echo "  down                             Stop the development environment."
  echo ""
  echo "  list [--watch]                   List all running apps."
  echo "                                   --watch: Continuously monitor the app list."
  echo ""
  echo "  attach                           Attach to the running dev server."
  echo ""
  echo "  start [app]                      Start a specified app."
  echo ""
  echo "  restart [app]                    Restart a specified app."
  echo ""
  echo "  stop [app]                       Stop a specified app."
  echo ""
  echo "  logs [app]                       Show logs for a specified app."
  echo ""
  echo "Additional options:"
  echo "  --help                           Show this usage screen."
  echo ""
  echo "Examples:"
  echo "  dev up                           Start the dev environment."
  echo "  dev list --watch                 Continuously list running apps."
  echo "  dev logs my-app                  Show logs for 'my-app'."
  echo ""
  exit 0
}

# Select action if not provided or show help
if [[ -z "$arg_action" ]]; then
  action=$(printf "%s\n" "${actions[@]}" | fzf --reverse)
elif [[ "$arg_action" == "--help" ]] || ! [[ " ${actions[*]} " == *" $arg_action "* ]]; then
  usage
else
  action="$arg_action"
fi

# Exit if action is invalid or no action is selected
if [[ -z "$action" ]] || ! [[ " ${actions[*]} " == *" $action "* ]]; then
  eval "$action"
  exit 1
fi

# If action is 'up', run process-compose and exit
if [[ "$action" == "up" ]]; then
  if [[ "$arg_app" == "mobile" ]]; then
    cd apps/mobile && bun dev
    exit 0
  fi

  process-compose up -D -p $pc_port >/dev/null 2>&1
  sh "$PWD/tools/nix/scripts/dev.sh" list --watch
  sh "$PWD/tools/nix/scripts/dev.sh" down
  exit 0
fi

# Ensure the directory and file exist
process_compose_dir="$HOME/Library/Application Support/process-compose"
[[ ! -d "$process_compose_dir" ]] && mkdir -p "$process_compose_dir" && touch "$process_compose_dir/settings.yaml"

# Check if the server is running
if ! process-compose -p "$pc_port" list &>/dev/null; then
  echo "Error: Unable to connect to the process-compose server at port $PC_SOCKET_PATH."
  echo "Please ensure the server is running and try again."
  exit 1
fi

apps=($(process-compose -p "$pc_port" list))

if [[ "$action" == "down" ]]; then
  process-compose -p "$pc_port" down
  exit 0
fi

if [[ "$action" == "attach" ]]; then
  process-compose -p "$pc_port" attach
  echo "Use 'dev down' to stop the dev server."
  exit 0
fi

if [[ "$action" == "list" ]]; then
  if [[ "$arg_app" == "--watch" ]]; then
    watch process-compose -p "$pc_port" list -o wide
    exit 0
  fi
  process-compose -p "$pc_port" list -o wide
  exit 0
fi

# Define app options and select app(s)
appOptions=$(printf "%s\n" "${apps[@]}")
if [[ -z "$arg_app" ]]; then
  selected=$(printf "%s\n" "${appOptions}" | sort | fzf --reverse --multi)
else
  # Loop through apps to check if arg_app is valid
  if [[ ! " ${apps[*]} " =~ (^|[[:space:]])"$arg_app"($|[[:space:]]) ]]; then
    echo "Invalid app. Available apps:"
    printf "%s\n" "${appOptions}"
    exit 1
  else
    selected="$arg_app"
  fi
fi

if [[ "$action" == "logs" ]]; then
  if [[ -z "$selected" ]]; then
    exit 1
  fi

  display_logs() {
    local red=$(tput bold)$(tput setaf 1)$(tput smul)
    local yellow=$(tput setaf 3)
    local green=$(tput setaf 2)
    local blackonwhite=$(tput bold)$(tput setaf 0)$(tput setab 7)
    local reset=$(tput sgr0)

    process-compose -p "$pc_port" process logs "$selected" --follow |
      sed -E -u \
        -e "s/(ERROR|error|Error|FATAL|fatal)/${red}\1${reset}/g" \
        -e "s/(WARN|warn|Warning)/${yellow}\1${reset}/g" \
        -e "s/(INFO|info)/${green}\1${reset}/g" \
        -e "s/(Query|DEBUG)/${blackonwhite}\1${reset}/g" &
    log_pid=$!
  }

  for app in $selected; do
    # Start logs in the background
    display_logs
  done

  # Interactive loop to listen for key presses
  echo "Press 'r' to restart the app, 'q' to quit logs, or any other key for custom actions."
  while true; do
    read -n 1 -s key # Read a single key press silently
    case $key in
    r)
      echo "Restarting app(s)..."
      for app in $selected; do
        process-compose -p "$pc_port" process restart $app
      done
      ;;
    q)
      echo "Quitting logs..."
      kill $log_pid # Terminate the logs process
      exit 0
      ;;
    *)
      echo ""
      ;;
    esac
  done
fi

# Execute the action for selected app(s)
if [[ -n "$selected" ]]; then
  for app in $selected; do
    process-compose -p "$pc_port" process $action $app
    exit 0
  done
fi
