import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Placeholder home screen. The tab bar shell (#5) and design tokens (#4) replace this.
export default function Index() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <View style={styles.monogram}>
          <Text style={styles.monogramText}>ΣΣΛ</Text>
        </View>
        <Text style={styles.title}>Sigma Sigma Lambda Connect</Text>
        <Text style={styles.subtitle}>Project setup complete.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  monogram: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    color: '#C5A253',
    fontSize: 22,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6E6E73',
  },
});
