import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

const SIZE = 248;
const CORNER = 36;
const STROKE = 5;

/** Square target with lime corner brackets over a dimmed surround. */
export function ScanFrame({ dimmed }: { dimmed: boolean }) {
  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.shade} />
      <View style={styles.row}>
        <View style={styles.shade} />
        <View style={[styles.window, dimmed && styles.windowDimmed]}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <View style={styles.shade} />
      </View>
      <View style={styles.shade} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill },
  shade: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  row: { flexDirection: 'row', height: SIZE },
  window: { width: SIZE, height: SIZE },
  windowDimmed: { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.primary },
  tl: { top: 0, left: 0, borderTopWidth: STROKE, borderLeftWidth: STROKE, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: STROKE, borderRightWidth: STROKE, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: STROKE, borderLeftWidth: STROKE, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: STROKE, borderRightWidth: STROKE, borderBottomRightRadius: 18 },
});
