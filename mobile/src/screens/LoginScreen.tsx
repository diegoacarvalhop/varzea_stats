import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Button, StyleSheet, TextInput, View } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { login } from '@/services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    try {
      const res = await login({ email, password });
      if (res.mustChangePassword) {
        navigation.replace('ChangePassword');
        return;
      }
      navigation.replace('Dashboard');
    } catch {
      Alert.alert('Erro', 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer title="Entrar">
      <TextInput
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Senha"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      <View style={styles.row}>
        <Button title={loading ? 'Entrando…' : 'Entrar'} onPress={onSubmit} disabled={loading} color="#15803d" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
