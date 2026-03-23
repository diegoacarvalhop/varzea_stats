import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <ScreenContainer title="Dashboard">
      <Text style={styles.lead}>Toque em um card para abrir a área no app (ranking completo no site).</Text>
      <Pressable style={styles.card} onPress={() => navigation.navigate('Matches')}>
        <Text style={styles.cardTitle}>⚡ Tempo real</Text>
        <Text style={styles.cardText}>Partidas, equipes e lances.</Text>
        <Text style={styles.cta}>Abrir →</Text>
      </Pressable>
      <Pressable style={styles.card} onPress={() => navigation.navigate('Stats')}>
        <Text style={styles.cardTitle}>📊 Estatísticas</Text>
        <Text style={styles.cardText}>Escolha jogadores já escalados em alguma partida.</Text>
        <Text style={styles.cta}>Abrir →</Text>
      </Pressable>
      <View style={[styles.card, styles.disabled]}>
        <Text style={styles.cardTitle}>🏆 Ranking</Text>
        <Text style={styles.cardText}>Classificação por votos — use o painel web em /ranking.</Text>
      </View>
      <View style={[styles.card, styles.disabled]}>
        <Text style={styles.cardTitle}>🎬 Mídia</Text>
        <Text style={styles.cardText}>Upload de URLs — disponível no site (ADMIN / MEDIA).</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lead: { marginBottom: 16, color: '#475569' },
  card: {
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  disabled: { opacity: 0.85 },
  cardTitle: { fontWeight: '700', fontSize: 16, marginBottom: 6, color: '#0f172a' },
  cardText: { color: '#64748b', fontSize: 14 },
  cta: { marginTop: 10, fontWeight: '600', color: '#15803d', fontSize: 13 },
});
