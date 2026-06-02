import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../context/ThemeContext';

const getStyles = (colors) => StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 20 },
  btn: { backgroundColor: colors.primary, paddingHorizontal: 30, paddingVertical: 14, borderRadius: 10 },
  btnText: { color: colors.headerText, fontSize: 16, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  frame: { width: 250, height: 250, borderWidth: 2, borderColor: '#00ff88', borderRadius: 12 },
  hint: { color: colors.headerText, fontSize: 14, marginTop: 30, opacity: 0.8 },
  rescanBtn: { marginTop: 20, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10 },
  close: { position: 'absolute', top: 50, right: 16 },
});

const Corner = () => (
  <View style={{
    width: 30, height: 30,
    borderTopWidth: 3, borderLeftWidth: 3,
    borderColor: '#00ff88',
    position: 'absolute', top: 0, left: 0
  }} />
);

export default function ScannerScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const mode = route.params?.mode || 'add';
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  const handleScan = ({ data }) => {
    if (scanned) return;
    setScanned(true);

    if (mode === 'add') {
      navigation.navigate('Main', { screen: 'Products', params: { screen: 'AddProduct', params: { barcode: data } } });
    } else {
      navigation.navigate('Main', { screen: 'Cart', params: { screen: 'CartMain', params: { scannedBarcode: data } } });
    }
  };

  if (!permission) return (
    <View style={styles.center}>
      <Text style={{ color: colors.headerText }}>Requesting camera permission...</Text>
    </View>
  );

  if (!permission.granted) return (
    <View style={styles.center}>
      <Text style={{ color: colors.headerText, fontSize: 16, textAlign: 'center', marginBottom: 20 }}>
        Camera permission required to scan barcodes
      </Text>
      <TouchableOpacity style={styles.btn} onPress={requestPermission}>
        <Text style={styles.btnText}>Grant Permission</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'itf14'] }}
        onBarcodeScanned={scanned ? undefined : handleScan}
      />
      <View style={styles.overlay}>
        <View style={styles.frame}>
          <Corner />
        </View>
        <Text style={styles.hint}>Point camera at barcode or QR code</Text>
        {scanned && (
          <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
            <Text style={{ color: colors.headerText, fontSize: 16 }}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()}>
        <Text style={{ color: colors.headerText, fontSize: 18 }}>✕ Close</Text>
      </TouchableOpacity>
    </View>
  );
}
