import { Text, View } from "react-native";

type StepProgressProps = {
  /** 1-based. */
  step: number;
  total: number;
};

export function StepProgress({ step, total }: StepProgressProps) {
  return (
    <View className="gap-2">
      <Text className="text-caption text-ink-muted">
        Step {step} of {total}
      </Text>
      <View
        accessibilityLabel={`Step ${step} of ${total}`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: step }}
        className="h-1 flex-row gap-1.5"
      >
        {Array.from({ length: total }, (_, index) => (
          <View
            className={`h-1 flex-1 rounded-pill ${
              index < step ? "bg-primary" : "bg-surface-sunken"
            }`}
            key={index}
          />
        ))}
      </View>
    </View>
  );
}
