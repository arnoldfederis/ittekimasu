import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "@/constants/theme";
import type { UserChecklistTaskResponse } from "@/lib/api";
import { dueHint, needsAttention } from "@/lib/checklist";

type TaskRowProps = {
  task: UserChecklistTaskResponse;
  onToggle: (completed: boolean) => void;
};

export function TaskRow({ task, onToggle }: TaskRowProps) {
  const colors = useThemeColors();
  const attention = needsAttention(task);
  const hint = dueHint(task);

  return (
    <Pressable
      accessibilityLabel={task.title}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.completed }}
      className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-surface-sunken"
      onPress={() => onToggle(!task.completed)}
    >
      {/*
        A filled teal check when done, a neutral grey circle when not. Uncompleted is never
        a warning colour — an unfinished task is not a mistake.
      */}
      <Image
        source={task.completed ? "sf:checkmark.circle.fill" : "sf:circle"}
        style={{ width: 24, height: 24 }}
        tintColor={task.completed ? colors.primary : colors.inkSubtle}
      />

      <View className="flex-1 gap-0.5">
        <Text
          className={`text-body ${
            task.completed ? "text-ink-subtle line-through" : "text-ink"
          }`}
        >
          {task.title}
        </Text>
        {hint && !task.completed ? (
          <Text
            className={`text-caption ${attention ? "text-accent" : "text-ink-muted"}`}
          >
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
