import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useThemeColors } from "@/constants/theme";

export default function TabLayout() {
  const colors = useThemeColors();

  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={colors.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          md="home"
          sf={{ default: "house", selected: "house.fill" }}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="checklist">
        <NativeTabs.Trigger.Icon
          md="checklist"
          sf={{ default: "checklist", selected: "checklist" }}
        />
        <NativeTabs.Trigger.Label>Checklist</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="learn">
        <NativeTabs.Trigger.Icon
          md="school"
          sf={{
            default: "character.book.closed",
            selected: "character.book.closed.fill",
          }}
        />
        <NativeTabs.Trigger.Label>Learn</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          md="person"
          sf={{ default: "person.circle", selected: "person.circle.fill" }}
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
