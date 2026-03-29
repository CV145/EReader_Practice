import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NotebookPanel from '../components/NotebookSheet';
import { updateLastReadCfi } from '../database/db';
import TOCModal from '../components/TOCModal';
import AIChatModal from '../components/AIChatModal';

export default function ReaderScreen({ route, navigation }) {
  const { book } = route.params;
  const webViewRef = useRef(null);
  const insets = useSafeAreaInsets();
  
  const [base64, setBase64] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toc, setToc] = useState([]);
  const [showToc, setShowToc] = useState(false);
  const [showNotebook, setShowNotebook] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [chapterText, setChapterText] = useState('');
  const [showControls, setShowControls] = useState(true);
  
  // Animation for the toolbar and back button
  const controlsAnim = useRef(new Animated.Value(0)).current; // 0 = visible, 1 = hidden

  useEffect(() => {
    Animated.timing(controlsAnim, {
      toValue: showControls ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showControls]);

  useEffect(() => {
    navigation.setOptions({ title: book.title.replace('.epub', '') });
    
    const loadFile = async () => {
      try {
        const fileContent = await FileSystem.readAsStringAsync(book.fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setBase64(fileContent);
      } catch (err) {
        console.error('Error reading epub', err);
      }
    };
    
    loadFile();
  }, [book]);

  const INJECTED_JAVASCRIPT = `
    window.onerror = function(message, source, lineno, colno, error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', data: message }));
      return true;
    };
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";
  `;

  const getHTML = () => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js"></script>
      <style>
        body, html { 
          margin: 0; padding: 0; height: 100vh; overflow: hidden; 
          background: #FAF6F0; 
        }
        #viewer { width: 100vw; height: 100vh; }
      </style>
    </head>
    <body>
      <div id="viewer"></div>
      <script>
        try {
          document.addEventListener('message', function(event) {
            handleMessage(event.data);
          });
          window.addEventListener('message', function(event) {
            handleMessage(event.data);
          });

          var book = ePub();
          var rendition;
          
          function init(base64Data, lastCfi) {
             book.open(base64Data, "base64");
             rendition = book.renderTo("viewer", {
                width: "100%",
                height: "100%",
                spread: "none",
                manager: "continuous",
                flow: "paginated"
             });

             rendition.themes.default({
               body: {
                 'background': '#FAF6F0 !important',
                 'color': '#2C2C2C !important',
                 'font-family': 'Georgia, "Times New Roman", serif !important',
                 'line-height': '1.8 !important',
                 'padding': '0 8px !important'
               },
               'a': { 'color': '#8B6914 !important' }
             });

             var display = rendition.display(lastCfi || undefined);
             
             display.then(function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
             });
             
             book.loaded.navigation.then(function(nav) {
                var items = [];
                function flatten(toc) {
                   toc.forEach(function(item) {
                      items.push({ label: item.label, href: item.href });
                      if (item.subitems && item.subitems.length > 0) { flatten(item.subitems); }
                   });
                }
                flatten(nav.toc);
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'toc', data: items }));
             });
             
             rendition.on('relocated', function(location) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loc', cfi: location.start.cfi }));
             });
             
             rendition.on('selected', function(cfiRange, contents) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'highlight', cfi: cfiRange }));
             });
          }

          function handleMessage(messageStr) {
            var msg = JSON.parse(messageStr);
            if (msg.type === 'init') {
                init(msg.base64, msg.lastCfi);
            } else if (msg.type === 'next') {
                rendition.next();
            } else if (msg.type === 'prev') {
                rendition.prev();
            } else if (msg.type === 'goto') {
                rendition.display(msg.cfi);
            } else if (msg.type === 'getChapterText') {
                 var location = rendition.currentLocation();
                 var section = book.spine.get(location.start.index);
                 section.load(book.load.bind(book)).then(function(doc) {
                    var text = (doc && doc.body) ? doc.body.textContent : (typeof doc === 'string' ? doc : "");
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'chapterText', text: text }));
                 });
             }
          }
        } catch(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', data: e.toString() }));
        }
      </script>
    </body>
    </html>
  `;

  const onMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'error') {
        console.error("WebView ePub Error:", data.data);
      } else if (data.type === 'ready') {
        setLoading(false);
      } else if (data.type === 'toc') {
        setToc(data.data);
      } else if (data.type === 'loc') {
        updateLastReadCfi(book.id, data.cfi);
      } else if (data.type === 'chapterText') {
        setChapterText(data.text);
      }
    } catch (e) {
      // Ignored
    }
  };

  const onLoadEnd = () => {
    if (webViewRef.current && base64) {
       webViewRef.current.postMessage(JSON.stringify({
         type: 'init',
         base64: base64,
         lastCfi: book.lastReadCfi
       }));
    }
  };

  const handleNext = () => webViewRef.current?.postMessage(JSON.stringify({ type: 'next' }));
  const handlePrev = () => webViewRef.current?.postMessage(JSON.stringify({ type: 'prev' }));
  const toggleControls = () => setShowControls(!showControls);

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {loading && <View style={styles.loading}><ActivityIndicator size="large" color="#8B6914" /><Text style={styles.loadingText}>Opening book…</Text></View>}

      <Animated.View style={[styles.backBtnContainer, { 
        opacity: controlsAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ translateY: controlsAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) }]
      }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} disabled={!showControls}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
      </Animated.View>
      
      {base64 && (
        <View style={showNotebook ? styles.viewerHalf : styles.viewerFull}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: getHTML() }}
            injectedJavaScript={INJECTED_JAVASCRIPT}
            onMessage={onMessage}
            onLoadEnd={onLoadEnd}
            style={{ backgroundColor: '#FAF6F0' }}
          />

          <View style={styles.tapLayer} pointerEvents="box-none">
            <TouchableOpacity style={styles.leftZone} onPress={handlePrev} />
            <TouchableOpacity style={styles.centerZone} onPress={toggleControls} />
            <TouchableOpacity style={styles.rightZone} onPress={handleNext} />
          </View>

          <Animated.View style={[styles.sideToolbar, { bottom: 80 + insets.bottom }, { 
            transform: [{ translateX: controlsAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }) }],
            opacity: controlsAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
          }]}>
            <TouchableOpacity style={styles.sideBtn} onPress={() => setShowToc(true)}><Text style={styles.sideBtnText}>☰</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.sideBtn, showNotebook && styles.sideBtnActive]} onPress={() => setShowNotebook(!showNotebook)}><Text style={[styles.sideBtnText, showNotebook && styles.sideBtnTextActive]}>✎</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sideBtn} onPress={() => { webViewRef.current?.postMessage(JSON.stringify({ type: 'getChapterText' })); setShowAI(true); }}><Text style={styles.sideBtnText}>✦</Text></TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {showNotebook && <View style={styles.notebookHalf}><NotebookPanel bookId={book.id} onClose={() => setShowNotebook(false)} /></View>}

      <TOCModal visible={showToc} toc={toc} onClose={() => setShowToc(false)} onSelect={(href) => { setShowToc(false); webViewRef.current?.postMessage(JSON.stringify({ type: 'goto', cfi: href })); }} />
      <AIChatModal visible={showAI} onClose={() => setShowAI(false)} bookId={book.id} chapterText={chapterText} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF6F0' },
  loading: { ...StyleSheet.absoluteFillObject, zIndex: 10, backgroundColor: 'rgba(250, 246, 240, 0.92)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 14, color: '#8B6914', fontSize: 15, fontWeight: '500' },
  backBtnContainer: { position: 'absolute', top: 8, left: 8, zIndex: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(250, 246, 240, 0.9)', justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 28, color: '#8B6914', fontWeight: '300', marginTop: -2 },
  viewerFull: { flex: 1, position: 'relative' },
  viewerHalf: { flex: 1, position: 'relative' },
  notebookHalf: { flex: 1 },
  tapLayer: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 2 },
  leftZone: { flex: 3 },
  centerZone: { flex: 4 },
  rightZone: { flex: 3 },
  sideToolbar: { position: 'absolute', right: 0, zIndex: 5, backgroundColor: '#8B6914', borderTopLeftRadius: 12, borderBottomLeftRadius: 12, paddingVertical: 6, paddingHorizontal: 4, elevation: 4 },
  sideBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center', marginVertical: 2 },
  sideBtnActive: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 },
  sideBtnText: { color: '#FFF8F0', fontSize: 18, fontWeight: '600' },
  sideBtnTextActive: { color: '#fff' },
});
