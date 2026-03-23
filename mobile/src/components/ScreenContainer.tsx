import type { ReactNode } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ScreenContainerProps {
  title?: string;
  children: ReactNode;
}

export function ScreenContainer({ title, children }: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { padding: 16, paddingBottom: 32 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  body: { gap: 8 },
});
