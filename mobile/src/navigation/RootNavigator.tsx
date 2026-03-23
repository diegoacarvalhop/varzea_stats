import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { ChangePasswordScreen } from '@/screens/ChangePasswordScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { MatchesScreen } from '@/screens/MatchesScreen';
import { StatsScreen } from '@/screens/StatsScreen';

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  ChangePassword: undefined;
  Dashboard: undefined;
  Matches: undefined;
  Stats: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: '#14532d' },
        headerTintColor: '#ecfdf5',
        contentStyle: { backgroundColor: '#f1f5f9' },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'VARzea Stats' }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Entrar' }} />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Definir senha' }}
      />
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Stack.Screen name="Matches" component={MatchesScreen} options={{ title: 'Partidas' }} />
      <Stack.Screen name="Stats" component={StatsScreen} options={{ title: 'Estatísticas' }} />
    </Stack.Navigator>
  );
}
