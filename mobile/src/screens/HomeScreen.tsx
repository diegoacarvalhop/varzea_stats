import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  return (
    <ScreenContainer title="VARzea Stats">
      <Text style={styles.lead}>Análise de partidas amadoras com estatísticas e gamificação.</Text>
      <View style={styles.row}>
        <Button title="Entrar" onPress={() => navigation.navigate('Login')} color="#15803d" />
      </View>
      <View style={styles.row}>
        <Button title="Dashboard" onPress={() => navigation.navigate('Dashboard')} />
      </View>
      <View style={styles.row}>
        <Button title="Partidas" onPress={() => navigation.navigate('Matches')} />
      </View>
      <View style={styles.row}>
        <Button title="Estatísticas" onPress={() => navigation.navigate('Stats')} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lead: { color: '#334155', marginBottom: 16, lineHeight: 22 },
  row: { marginVertical: 4 },
});
