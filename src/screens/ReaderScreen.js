import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import Tts from 'react-native-tts';
import NotebookPanel from '../components/NotebookSheet';
import { updateLastReadCfi } from '../database/db';
import TOCModal from '../components/TOCModal';
import AIChatModal from '../components/AIChatModal';
import { Ionicons } from '@expo/vector-icons';


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
  
  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [showTTSOverlay, setShowTTSOverlay] = useState(false);
  const currentCfi = useRef(null);
  const ttsTextRef = useRef('');
  
  // Animation for the toolbar and back button
  const controlsAnim = useRef(new Animated.Value(0)).current; // 0 = visible, 1 = hidden
  const ttsOverlayAnim = useRef(new Animated.Value(0)).current; 

  useEffect(() => {
    Animated.timing(controlsAnim, {
      toValue: showControls ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showControls]);

  useEffect(() => {
    Animated.spring(ttsOverlayAnim, {
      toValue: showTTSOverlay ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 40
    }).start();
  }, [showTTSOverlay]);

  useEffect(() => {
    const configureAudio = async () => {
       try {
          await Audio.setAudioModeAsync({
             playsInSilentModeIOS: true,
             allowsRecordingIOS: false,
             staysActiveInBackground: true,
             shouldDuckAndroid: true,
             playThroughEarpieceAndroid: false,
          });
       } catch (e) {
          console.warn("Failed to set audio mode", e);
       }
    };
    // Initialize react-native-tts
    Tts.getInitStatus().then(() => {
      Tts.setDefaultLanguage('en-US');
      Tts.setDefaultRate(speechRate);
      console.log("[TTS] Native Engine Ready");
    }).catch((err) => {
      if (err.code === 'no_engine') {
        Tts.requestInstallEngine();
      }
      console.error("[TTS] Init Error:", err);
    });

    // Native word boundary events from Android's UtteranceProgressListener.onRangeStart
    const progressSub = Tts.addEventListener('tts-progress', (event) => {
      // Android often uses 'start'/'end', while iOS uses 'location'/'length'
      const start = event.location !== undefined ? event.location : event.start;
      const end = event.end !== undefined ? event.end : (start + (event.length || 0));
      const length = event.length !== undefined ? event.length : (end - start);

      console.log(`[TTS Progress] Raw:`, JSON.stringify(event));
      console.log(`[TTS Progress] Normalized -> start: ${start}, length: ${length}`);

      if (start !== undefined && length !== undefined && webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `if (window.highlightWordOnPage) { highlightWordOnPage(${start}, ${length}); } true;`
        );
      }
    });

    const startSub = Tts.addEventListener('tts-start', () => {
       console.log("[TTS] Audio Started");
    });

    const finishSub = Tts.addEventListener('tts-finish', () => {
      console.log("[TTS] Audio Finished");
      setSpeakingState(false);
      setPausedState(false);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript('clearHighlights(); true;');
      }
    });

    const cancelSub = Tts.addEventListener('tts-cancel', () => {
      setSpeakingState(false);
      setPausedState(false);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript('clearHighlights(); true;');
      }
    });

    return () => {
       Tts.stop();
       progressSub?.remove();
       finishSub?.remove();
       cancelSub?.remove();
    };
  }, []);

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
        
        ::highlight(tts-word) {
          background-color: #f1c40f;
          color: #000;
        }
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
          var currentPageCfiRange = null;
          var currentUtterance = null;
          
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
                'a': { 'color': '#8B6914 !important' },
                '::highlight(tts-word)': {
                  'background-color': '#f1c40f !important',
                  'color': '#000 !important'
                }
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

           function clearHighlights() {
              var contents = rendition.getContents()[0];
              if (contents && contents.window.CSS && contents.window.CSS.highlights) {
                contents.window.CSS.highlights.clear();
              }
           }

           function highlightWordOnPage(wordStartIndex, wordLength) {
              if (!currentPageCfiRange) return;
              var contents = rendition.getContents()[0];
              if (!contents) return;
              var doc = contents.document;

               // Use Custom Highlight API for non-destructive highlighting
               if (!contents.window.CSS || !contents.window.CSS.highlights) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ 
                    type: 'debug', 
                    data: 'CSS Highlights API not supported in this WebView' 
                  }));
                  return;
               }

               // Get the live DOM Range of the visible page
               var pageRange;
               try {
                  pageRange = contents.range(currentPageCfiRange);
               } catch(e) {
                  return;
               }
               if (!pageRange) return;

               // TreeWalker bounded by the page range common ancestor
               var walker = doc.createTreeWalker(
                  pageRange.commonAncestorContainer,
                  NodeFilter.SHOW_TEXT,
                  null,
                  false
               );

               // Fast-forward to the page start node
               walker.currentNode = pageRange.startContainer;

               var currentTotalCount = 0;
               var startNode = null;
               var sOffset = 0;
               var endNode = null;
               var eOffset = 0;

               var node = walker.currentNode;
               while (node) {
                  var isFirstNode = (node === pageRange.startContainer);
                  var isLastNode = (node === pageRange.endContainer);

                  var nodeTextStart = isFirstNode ? pageRange.startOffset : 0;
                  var nodeTextEnd = isLastNode ? pageRange.endOffset : node.nodeValue.length;
                  var nodeTextLength = nodeTextEnd - nodeTextStart;

                  if (!startNode && currentTotalCount + nodeTextLength > wordStartIndex) {
                     startNode = node;
                     sOffset = nodeTextStart + (wordStartIndex - currentTotalCount);
                  }

                  if (startNode && !endNode && currentTotalCount + nodeTextLength >= wordStartIndex + wordLength) {
                     endNode = node;
                     eOffset = nodeTextStart + ((wordStartIndex + wordLength) - currentTotalCount);
                     break;
                  }

                  currentTotalCount += nodeTextLength;
                  if (isLastNode) break;
                  node = walker.nextNode();
               }

               if (startNode && endNode) {
                  try {
                    var wordRange = doc.createRange();
                    wordRange.setStart(startNode, sOffset);
                    wordRange.setEnd(endNode, eOffset);
                    
                    var highlight = new contents.window.Highlight(wordRange);
                    contents.window.CSS.highlights.set('tts-word', highlight);
                    
                    // Log to RN to confirm success
                    window.ReactNativeWebView.postMessage(JSON.stringify({ 
                      type: 'debug', 
                      data: 'Highlight applied for index ' + wordStartIndex 
                    }));
                  } catch(e) {
                     window.ReactNativeWebView.postMessage(JSON.stringify({ 
                       type: 'debug', 
                       data: 'Highlight failed: ' + e.toString() 
                     }));
                  }
               } else {
                 window.ReactNativeWebView.postMessage(JSON.stringify({ 
                   type: 'debug', 
                   data: 'Nodes not found for index ' + wordStartIndex 
                 }));
              }
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
                  
                  // Extract only visible page text via CFI range
                  async function extractCurrentVisibleText() {
                      var location = rendition.currentLocation();
                      if (!location || !location.start || !location.end) {
                         return "";
                      }
                      
                      var startCfi = location.start.cfi;
                      var endCfi = location.end.cfi;

                      var PREFIX = "epubcfi(";
                      function parseCfi(cfi) {
                         if (cfi.indexOf(PREFIX) !== 0) return null;
                         var inner = cfi.substring(PREFIX.length, cfi.length - 1);
                         var bangIdx = inner.indexOf("!");
                         if (bangIdx === -1) return null;
                         return { base: inner.substring(0, bangIdx), path: inner.substring(bangIdx + 1) };
                      }

                      var startParts = parseCfi(startCfi);
                      var endParts = parseCfi(endCfi);
                      if (!startParts || !endParts) return "";

                      var startSegs = startParts.path.split("/");
                      var endSegs = endParts.path.split("/");
                      var commonSegs = [];
                      for (var i = 0; i < Math.min(startSegs.length, endSegs.length); i++) {
                         if (startSegs[i] === endSegs[i]) {
                            commonSegs.push(startSegs[i]);
                         } else {
                            break;
                         }
                      }
                      var commonPath = commonSegs.join("/");
                      var startSuffix = "/" + startSegs.slice(commonSegs.length).join("/");
                      var endSuffix = "/" + endSegs.slice(commonSegs.length).join("/");

                      var cfiRange = "epubcfi(" + startParts.base + "!" + commonPath + "," + startSuffix + "," + endSuffix + ")";

                      // Store for highlighting
                      currentPageCfiRange = cfiRange;

                      try {
                         var range = await book.getRange(cfiRange);
                         if (range) {
                              var rawText = range.toString();
                              if (rawText.length > 0) {
                                 return rawText;
                              }
                         }
                      } catch(e) {
                         // CFI range extraction failed
                      }

                      return "";
                  }
                  
                  extractCurrentVisibleText().then(function(text) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'chapterText', text: text, isTTS: msg.isTTS }));
                  }).catch(function(e) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'chapterText', text: "", isTTS: msg.isTTS }));
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
        currentCfi.current = data.cfi;
      } else if (data.type === 'chapterText') {
        if (data.isTTS) {
           const text = data.text || '';
           ttsTextRef.current = text;
           Tts.setDefaultRate(speechRate);
           Tts.speak(text);
           setSpeakingState(true);
           setPausedState(false);
        } else {
           setChapterText(data.text);
        }
      } else if (data.type === 'debug') {
        console.log("[WebView Debug]", data.data);
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

  const setSpeakingState = (val) => {
     setIsSpeaking(val);
  };
  
  const setPausedState = (val) => {
     setIsPaused(val);
  };

  const handleNext = () => webViewRef.current?.postMessage(JSON.stringify({ type: 'next' }));
  const handlePrev = () => webViewRef.current?.postMessage(JSON.stringify({ type: 'prev' }));
  const toggleControls = () => setShowControls(!showControls);

  const toggleTTS = () => {
    if (isSpeaking) {
      if (isPaused) {
        Tts.resume();
        setPausedState(false);
      } else {
        Tts.pause();
        setPausedState(true);
      }
    } else {
       webViewRef.current?.postMessage(JSON.stringify({ type: 'getChapterText', isTTS: true }));
       setShowTTSOverlay(true);
    }
  };

  const stopTTS = () => {
    Tts.stop();
    setSpeakingState(false);
    setPausedState(false);
    setShowTTSOverlay(false);
    webViewRef.current?.injectJavaScript('clearHighlights(); true;');
  };

  const changeRate = (newRate) => {
     setSpeechRate(newRate);
     if (isSpeaking) {
        Tts.stop();
        Tts.setDefaultRate(newRate);
        webViewRef.current?.postMessage(JSON.stringify({ type: 'getChapterText', isTTS: true }));
     }
  };

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
            <TouchableOpacity style={[styles.sideBtn, isSpeaking && styles.sideBtnActive]} onPress={toggleTTS}><Text style={styles.sideBtnText}>🔊</Text></TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* TTS Premium Overlay */}
      <Animated.View style={[styles.ttsOverlay, { 
        transform: [{ translateY: ttsOverlayAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] }) }],
        opacity: ttsOverlayAnim
      }]} pointerEvents={showTTSOverlay ? 'auto' : 'none'}>
        <View style={styles.ttsHeader}>
           <Text style={styles.ttsTitle}>Reading Aloud</Text>
           <TouchableOpacity onPress={stopTTS}><Ionicons name="close" size={24} color="#8B6914" /></TouchableOpacity>
        </View>
        
        <View style={styles.ttsControls}>
           <TouchableOpacity onPress={() => changeRate(Math.max(0.5, speechRate - 0.25))} style={styles.rateBtn}>
             <Text style={styles.rateBtnText}>-</Text>
           </TouchableOpacity>
           
           <TouchableOpacity onPress={toggleTTS} style={styles.playBtn}>
             <Ionicons name={isPaused ? "play" : "pause"} size={32} color="#fff" />
           </TouchableOpacity>
           
           <TouchableOpacity onPress={() => changeRate(Math.min(2.0, speechRate + 0.25))} style={styles.rateBtn}>
             <Text style={styles.rateBtnText}>+</Text>
           </TouchableOpacity>
        </View>
        
        <Text style={styles.speedLabel}>{speechRate.toFixed(2)}x Speed</Text>
      </Animated.View>

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
  
  // TTS Overlay Styles
  ttsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FAF6F0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 100,
  },
  ttsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  ttsTitle: { fontSize: 18, fontWeight: '700', color: '#8B6914', fontFamily: 'Georgia' },
  ttsControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 30 },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#8B6914', justifyContent: 'center', alignItems: 'center', shadowColor: "#8B6914", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  rateBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#8B6914', justifyContent: 'center', alignItems: 'center' },
  rateBtnText: { fontSize: 24, color: '#8B6914', fontWeight: '300' },
  speedLabel: { textAlign: 'center', marginTop: 16, color: '#8B6914', fontSize: 14, fontWeight: '600', opacity: 0.8 },
});
