import { zodResolver } from "@hookform/resolvers/zod";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";
import { Button } from "@/components/button";
import { KanaQuizResults } from "@/components/kana-quiz-results";
import { TextField } from "@/components/text-field";
import { glyphOf, type KanaCard } from "@/constants/kana";
import { useThemeColors } from "@/constants/theme";
import { useKanaProgressBackup } from "@/lib/kana-progress";
import {
  buildChoices,
  isCorrectAnswer,
  type QuizAnswer,
  type QuizMode,
} from "@/lib/kana-quiz";
import {
  applyAudioMode,
  getSelectedVoice,
  isSoundEnabled,
  speakReading,
  stopSpeaking,
} from "@/lib/speech";

/**
 * How long the answer stays on screen before the next question.
 *
 * Longer for a miss: the learner needs time to read the right answer, and that moment is the
 * whole teaching value of getting one wrong. A right answer only needs long enough to feel it.
 */
const ADVANCE_AFTER_CORRECT_MS = 700;
const ADVANCE_AFTER_MISS_MS = 1500;

const answerSchema = z.object({
  answer: z.string().trim().min(1, "Type what it says."),
});
type AnswerForm = z.infer<typeof answerSchema>;

type Feedback = { given: string; correct: boolean };

type KanaQuizProps = {
  /** The shuffled deck, or null while closed. */
  deck: KanaCard[] | null;
  mode: QuizMode;
  onClose: () => void;
};

/**
 * The kana quiz: every picked character once, in random order, answered by choice (easy) or
 * by typing the romaji (hard).
 *
 * It replaced a practice sheet you swiped through and tapped to reveal. That tested nothing —
 * the learner decided for themselves whether they had "known" it — and recorded nothing. Here
 * the answer is checked, timed, and saved.
 *
 * Deliberately NOT a pager: no swiping between questions. Going back to change an answer would
 * make the score meaningless, and a horizontal swipe on a quiz is too easy to make by accident.
 *
 * FULL SCREEN rather than a page sheet, for the same reason. A page sheet dismisses on a
 * downward swipe, which would skip the "leave practice?" prompt and silently throw away a
 * half-finished session. Here the only way out is the close button, which asks first.
 */
export function KanaQuiz({ deck, mode, onClose }: KanaQuizProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const open = deck !== null;

  /*
   * Held still while the modal animates out, as in kana-sheet.tsx: the parent clears `deck` on
   * close, and without this the results would blank out on the way down.
   */
  const [shown, setShown] = useState<{ deck: KanaCard[]; mode: QuizMode }>({
    deck: deck ?? [],
    mode,
  });

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [finished, setFinished] = useState(false);

  const questionShownAt = useRef(Date.now());
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { save, status } = useKanaProgressBackup();

  const form = useForm<AnswerForm>({
    resolver: zodResolver(answerSchema),
    defaultValues: { answer: "" },
  });
  const { reset } = form;

  // A fresh session every time it opens: new deck, clean slate.
  useEffect(() => {
    if (!deck) return;
    setShown({ deck, mode });
    setIndex(0);
    setAnswers([]);
    setFeedback(null);
    setFinished(false);
    reset({ answer: "" });
    questionShownAt.current = Date.now();
  }, [deck, mode, reset]);

  /*
   * Every screen that speaks claims the audio session on open (see lib/speech.ts): it is
   * process-wide, and without this the first answer after a cold launch is silent under the
   * ring switch.
   */
  useEffect(() => {
    if (open) applyAudioMode();
    else stopSpeaking();
  }, [open]);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const total = shown.deck.length;
  const card: KanaCard | undefined = shown.deck[index];

  /** Built once per question, so the options do not reshuffle under the thumb on a re-render. */
  const choices = useMemo(
    () => (card && shown.mode === "easy" ? buildChoices(card) : []),
    [card, shown.mode],
  );

  async function speak(target: KanaCard) {
    if (!(await isSoundEnabled())) return;
    // The glyph, never the romaji: a Japanese voice reading "ja" pronounces an English word.
    speakReading(
      glyphOf(target.entry, target.script),
      await getSelectedVoice(),
    );
  }

  function answer(given: string) {
    if (!card || feedback) return;

    const correct = isCorrectAnswer(card.entry, given);
    const next = [
      ...answers,
      { card, given, correct, ms: Date.now() - questionShownAt.current },
    ];

    setAnswers(next);
    setFeedback({ given, correct });
    // Right or wrong, hearing it is the point: the sound is what they are learning to read.
    speak(card);

    if (!correct && shown.mode === "hard") {
      // Amber, via the field's own error style — the right answer, not a verdict.
      form.setError("answer", {
        message: `It's “${card.entry.romaji}”.`,
      });
    }

    advanceTimer.current = setTimeout(
      () => advance(next),
      correct ? ADVANCE_AFTER_CORRECT_MS : ADVANCE_AFTER_MISS_MS,
    );
  }

  function advance(all: QuizAnswer[]) {
    setFeedback(null);
    form.reset({ answer: "" });

    if (all.length >= total) {
      setFinished(true);
      // Saved once, at the end — one write to the device and, for Pro, one request.
      save(all);
      return;
    }

    setIndex(all.length);
    questionShownAt.current = Date.now();
  }

  const submitTyped = form.handleSubmit(({ answer: typed }) => answer(typed));

  /**
   * Leaving early asks first, once anything has been answered.
   *
   * Three ways out, because "leave" hides two different wishes: keep what I did so far, or
   * throw this attempt away. An Alert rather than a toast — per CLAUDE.md, the one place an
   * Alert belongs is a choice that cannot be taken back.
   */
  function requestClose() {
    if (finished || answers.length === 0) {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      onClose();
      return;
    }

    Alert.alert(
      "Leave practice?",
      `You've answered ${answers.length} of ${total}.`,
      [
        {
          text: "Save and exit",
          onPress: () => {
            if (advanceTimer.current) clearTimeout(advanceTimer.current);
            save(answers);
            onClose();
          },
        },
        {
          text: "Exit without saving",
          style: "destructive",
          onPress: () => {
            if (advanceTimer.current) clearTimeout(advanceTimer.current);
            onClose();
          },
        },
        { text: "Keep practising", style: "cancel" },
      ],
    );
  }

  const cardBorder = feedback
    ? feedback.correct
      ? "border-positive"
      : "border-accent"
    : "border-transparent";

  return (
    <Modal
      animationType="slide"
      onRequestClose={requestClose}
      presentationStyle="fullScreen"
      visible={open}
    >
      <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between px-4 pt-2 pb-2">
          <Pressable
            accessibilityLabel={finished ? "Done" : "Leave practice"}
            accessibilityRole="button"
            className="min-h-11 min-w-11 justify-center active:opacity-60"
            onPress={requestClose}
          >
            <Image
              source="sf:xmark"
              style={{ width: 18, height: 18 }}
              tintColor={colors.inkMuted}
            />
          </Pressable>
          <Text className="font-semibold text-callout text-ink">
            {finished ? "Results" : `${Math.min(index + 1, total)} / ${total}`}
          </Text>
          <Text className="min-w-11 text-right text-callout text-ink-subtle">
            {shown.mode === "easy" ? "Easy" : "Hard"}
          </Text>
        </View>

        {/* Fills as questions are answered, so the last answer completes it. */}
        <View className="mx-4 h-1 overflow-hidden rounded-pill bg-surface-sunken">
          <View
            className="h-1 rounded-pill bg-primary"
            style={{ width: `${total ? (answers.length / total) * 100 : 0}%` }}
          />
        </View>

        {finished ? (
          <KanaQuizResults
            answers={answers}
            bottomInset={insets.bottom}
            onDone={requestClose}
            status={status}
          />
        ) : card ? (
          <ScrollView
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={{
              padding: 16,
              paddingBottom: 24 + insets.bottom,
              gap: 20,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              className={`items-center gap-2 rounded-card border-2 bg-surface px-6 py-10 ${cardBorder}`}
              style={{ borderCurve: "continuous" }}
            >
              {/*
                Which script, because a deck can mix them and "is this hiragana or katakana?"
                is a real question. Never the reading — that is the answer.
              */}
              <Text className="text-caption text-ink-subtle">
                {card.script === "hiragana" ? "Hiragana" : "Katakana"}
              </Text>
              <Text
                accessibilityLabel={`Which sound is ${glyphOf(card.entry, card.script)}?`}
                adjustsFontSizeToFit
                className="text-ink"
                minimumFontScale={0.5}
                numberOfLines={1}
                style={{ fontSize: card.entry.hiragana.length > 1 ? 80 : 104 }}
              >
                {glyphOf(card.entry, card.script)}
              </Text>
              {/* Holds its height before answering, so the card does not jump when it fills. */}
              <View className="h-7 justify-center">
                {feedback ? (
                  <Text
                    className={`font-semibold text-heading ${
                      feedback.correct ? "text-positive" : "text-accent"
                    }`}
                  >
                    {card.entry.romaji}
                  </Text>
                ) : null}
              </View>
            </View>

            {shown.mode === "easy" ? (
              <View className="flex-row flex-wrap gap-3">
                {choices.map((choice) => {
                  const isRight = isCorrectAnswer(card.entry, choice);
                  const isPicked = feedback?.given === choice;
                  const border = !feedback
                    ? "border-line"
                    : isRight
                      ? "border-positive"
                      : isPicked
                        ? "border-accent"
                        : "border-line";
                  const text = !feedback
                    ? "text-ink"
                    : isRight
                      ? "text-positive"
                      : isPicked
                        ? "text-accent"
                        : "text-ink-subtle";

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: feedback !== null }}
                      className={`min-h-16 items-center justify-center rounded-button border-2 bg-surface active:bg-surface-sunken ${border}`}
                      disabled={feedback !== null}
                      key={choice}
                      onPress={() => answer(choice)}
                      // Two per row: just under half, so the gap fits between them.
                      style={{
                        borderCurve: "continuous",
                        flexBasis: "45%",
                        flexGrow: 1,
                      }}
                    >
                      <Text className={`font-semibold text-heading ${text}`}>
                        {choice}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View className="gap-4">
                <TextField
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect={false}
                  autoFocus
                  control={form.control}
                  keyboardType="ascii-capable"
                  label="Romaji"
                  name="answer"
                  onSubmitEditing={submitTyped}
                  placeholder="e.g. ka"
                  returnKeyType="done"
                  spellCheck={false}
                  /*
                   * Keeps the keyboard up between questions, so a run of answers is typing,
                   * not dismissing and reopening the keyboard forty times.
                   *
                   * Never `editable={false}` while the answer is showing, however tempting:
                   * on iOS a focused field that stops being editable resigns first responder,
                   * which drops the keyboard after EVERY answer and overrides this prop
                   * entirely. `answer()` already ignores a submit while feedback is up, so
                   * the field can stay live.
                   */
                  submitBehavior="submit"
                />
                {/*
                  Not disabled during feedback, for the same reason: a tap on a disabled
                  button is not "handled", so the ScrollView takes it as a tap on empty space
                  and dismisses the keyboard. The guard in `answer()` makes it a no-op.
                */}
                <Button onPress={submitTyped} title="Check" />
              </View>
            )}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}
