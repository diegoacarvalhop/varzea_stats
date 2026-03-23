import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { changePassword } from '@/services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

export function ChangePasswordScreen({ navigation }: Props) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (novaSenha.length < 6) {
      Alert.alert('Validação', 'A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmar) {
      Alert.alert('Validação', 'A confirmação não coincide.');
      return;
    }
    setLoading(true);
    try {
      await changePassword({ senhaAtual, novaSenha });
      navigation.replace('Dashboard');
    } catch {
      Alert.alert('Erro', 'Verifique a senha atual.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer title="Nova senha">
      <Text style={styles.hint}>Defina uma senha pessoal (a inicial costuma ser 123456).</Text>
      <TextInput
        placeholder="Senha atual"
        secureTextEntry
        value={senhaAtual}
        onChangeText={setSenhaAtual}
        style={styles.input}
      />
      <TextInput
        placeholder="Nova senha"
        secureTextEntry
        value={novaSenha}
        onChangeText={setNovaSenha}
        style={styles.input}
      />
      <TextInput
        placeholder="Confirmar nova senha"
        secureTextEntry
        value={confirmar}
        onChangeText={setConfirmar}
        style={styles.input}
      />
      <View style={styles.row}>
        <Button title={loading ? 'Salvando…' : 'Salvar'} onPress={onSubmit} disabled={loading} color="#15803d" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hint: { marginBottom: 12, color: '#334155' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  row: { marginTop: 8 },
});
