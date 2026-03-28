import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { formatPlayerDirectoryLabel, listPlayersDirectory, type PlayerDirectoryEntry } from '@/services/playerService';
import { getPlayerStats, type PlayerStats } from '@/services/statsService';

export function StatsScreen() {
  const [players, setPlayers] = useState<PlayerDirectoryEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const loadDirectory = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await listPlayersDirectory();
      setPlayers(data);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar a lista de jogadores.');
      setPlayers([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  async function loadStats(playerId: number) {
    setStatsLoading(true);
    setStats(null);
    try {
      const data = await getPlayerStats(playerId);
      setStats(data);
    } catch {
      Alert.alert('Erro', 'Jogador não encontrado ou API indisponível.');
    } finally {
      setStatsLoading(false);
    }
  }

  return (
    <ScreenContainer title="Estatísticas">
      <Text style={styles.lead}>
        Toque em um jogador que já foi cadastrado em alguma equipe. A lista reúne todas as partidas.
      </Text>
      {listLoading ? (
        <ActivityIndicator style={{ marginVertical: 16 }} />
      ) : players.length === 0 ? (
        <Text style={styles.muted}>Nenhum jogador. Cadastre na partida no site.</Text>
      ) : (
        <>
          <FlatList
            data={players}
            keyExtractor={(item) => String(item.playerId)}
            style={styles.list}
            nestedScrollEnabled
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => void loadStats(item.playerId)} activeOpacity={0.7}>
                <Text style={styles.rowText}>{formatPlayerDirectoryLabel(item)}</Text>
              </TouchableOpacity>
            )}
          />
          {statsLoading ? <ActivityIndicator style={{ marginVertical: 12 }} /> : null}
          {stats ? (
            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>
                {stats.playerName}
                {stats.goalkeeper ? ' (Goleiro)' : ''}
              </Text>
              {stats.teamName ? <Text style={styles.muted}>{stats.teamName}</Text> : null}
              <Text style={styles.eventsTitle}>Lances (principal)</Text>
              {Object.entries(stats.eventsByType).map(([k, v]) => (
                <Text key={k} style={styles.sub}>
                  {k.replace(/_/g, ' ')}: {v}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lead: { marginBottom: 12, color: '#475569', fontSize: 14 },
  muted: { color: '#64748b', marginVertical: 8 },
  list: { flexGrow: 0, maxHeight: 320 },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  rowText: { fontSize: 14, color: '#0f172a' },
  statsCard: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  statsTitle: { fontSize: 17, fontWeight: '700', color: '#14532d' },
  sub: { marginTop: 4, fontSize: 14, color: '#334155' },
  eventsTitle: { marginTop: 10, fontWeight: '600', color: '#14532d' },
});
