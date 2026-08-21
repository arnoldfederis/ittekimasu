import { Redirect } from "expo-router";

/** The flow starts at the purpose picker; /onboarding itself is just the entry point. */
export default function OnboardingIndex() {
  return <Redirect href="/onboarding/purpose" />;
}
