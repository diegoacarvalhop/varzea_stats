import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { listMatches, type Match } from '@/services/matchService';

export function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMatches();
      setMatches(data);
    } catch {
      setError('Falha ao carregar partidas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScreenContainer title="Partidas">
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <FlatList
        data={matches}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>#{item.id}</Text>
            <Text>{new Date(item.date).toLocaleString('pt-BR')}</Text>
            <Text>{item.location}</Text>
          </View>
        )}
        ListEmptyComponent={!loading ? <Text>Nenhuma partida.</Text> : null}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  err: { color: '#b91c1c' },
  card: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontWeight: '700', marginBottom: 4 },
});
