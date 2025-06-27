/**
 * Example component demonstrating shared package integration
 * This shows how to use design tokens, i18n, and other shared packages in React Native
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { lightColors, spacing, fontSize } from "@maps/design-tokens";

// Helper function to convert string font sizes to numbers for React Native
const parsePixelValue = (value: string): number => {
  return parseInt(value.replace("px", ""), 10);
};

export function ExampleSharedPackages() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shared Packages Working! 🎉</Text>
      <Text style={styles.description}>
        This component uses design tokens from @maps/design-tokens:
      </Text>
      <View style={styles.tokenExample}>
        <Text style={styles.tokenText}>• Primary Color: {lightColors.primary}</Text>
        <Text style={styles.tokenText}>• Spacing MD: {spacing.md}px</Text>
        <Text style={styles.tokenText}>• Font Size Base: {fontSize.base}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: lightColors.background,
    borderRadius: 12,
    margin: spacing.md,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  title: {
    fontSize: parsePixelValue(fontSize.xl),
    fontWeight: "600",
    color: lightColors.primary,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: parsePixelValue(fontSize.base),
    color: lightColors.foreground,
    marginBottom: spacing.md,
  },
  tokenExample: {
    backgroundColor: lightColors.muted,
    padding: spacing.md,
    borderRadius: 8,
  },
  tokenText: {
    fontSize: parsePixelValue(fontSize.sm),
    color: lightColors.mutedForeground,
    marginBottom: spacing.xs,
  },
});
