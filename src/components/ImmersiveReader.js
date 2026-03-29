import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import * as Speech from 'expo-speech';

/**
 * A standalone component for Immersive Reading using expo-speech instead of react-native-tts,
 * adhering strictly to the <Text> substring slicing pattern for real-time word highlighting.
 */
export default function ImmersiveReader({ currentPageText, readingSpeed = 1.0, isSpeaking = true, isPaused = false }) {
  // 1. State Management
  const [highlightRange, setHighlightRange] = useState({ start: 0, end: 0 });
  
  // Ref for Android estimation interval
  const androidIntervalRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const pauseTimeAccumulator = useRef(0);
  const lastPauseStart = useRef(0);

  // Pause / Resume listener
  useEffect(() => {
     if (isPaused) {
        Speech.pause();
        lastPauseStart.current = Date.now();
     } else if (isSpeaking) {
        if (lastPauseStart.current > 0) {
            pauseTimeAccumulator.current += (Date.now() - lastPauseStart.current);
            lastPauseStart.current = 0;
        }
        Speech.resume();
     }
  }, [isPaused, isSpeaking]);

  // 4. Page Turn Logic / Setup listener
  useEffect(() => {
    // Whenever component mounts or page changes, stop previous voice and reset state
    Speech.stop();
    setHighlightRange({ start: 0, end: 0 });
    if (androidIntervalRef.current) clearInterval(androidIntervalRef.current);

    if (!currentPageText || !isSpeaking) return;

    const readCurrentPage = async () => {
      // Small delay ensures previous stops complete natively
      await new Promise(resolve => setTimeout(resolve, 50)); 
      
      // We start fresh
      startTimeRef.current = Date.now();
      pauseTimeAccumulator.current = 0;
      lastPauseStart.current = 0;
      
      // Android Fallback Heuristic
      // Because expo-speech does not support onBoundary on Android natively.
      if (Platform.OS === 'android') {
        const words = [];
        let match;
        const regex = /\S+/g;
        while ((match = regex.exec(currentPageText)) !== null) {
            words.push({ start: match.index, end: match.index + match[0].length });
        }
        
        let cps = 13.5 * readingSpeed; // Appox chars per second
        
        androidIntervalRef.current = setInterval(() => {
            if (isPaused) return; // Skip updating offsets if paused

            const activeTimeMs = Date.now() - startTimeRef.current - pauseTimeAccumulator.current;
            const currentExpectedChar = Math.floor((activeTimeMs / 1000) * cps);
            
            const currentWord = words.find(w => w.start <= currentExpectedChar && (w.end + 8) > currentExpectedChar);
            if (currentWord) {
                setHighlightRange({ start: currentWord.start, end: currentWord.end });
            }
        }, 150);
      }

      // 2. TTS Event Listeners
      Speech.speak(currentPageText, {
        language: 'en-US',
        rate: readingSpeed,
        onBoundary: (event) => {
          // Native iOS Boundary event
          if (Platform.OS === 'ios') {
             setHighlightRange({
               start: event.charIndex,
               end: event.charIndex + event.charLength,
             });
          }
        },
        onDone: () => {
          setHighlightRange({ start: 0, end: 0 });
          if (androidIntervalRef.current) clearInterval(androidIntervalRef.current);
        },
        onStopped: () => {
          setHighlightRange({ start: 0, end: 0 });
          if (androidIntervalRef.current) clearInterval(androidIntervalRef.current);
        },
        onError: () => {
          setHighlightRange({ start: 0, end: 0 });
          if (androidIntervalRef.current) clearInterval(androidIntervalRef.current);
        }
      });
    };

    readCurrentPage();

    // Cleanup when component unmounts or string/state changes
    return () => {
      Speech.stop();
      if (androidIntervalRef.current) clearInterval(androidIntervalRef.current);
    };
  }, [currentPageText, isSpeaking, readingSpeed]);

  // Handle empty state
  if (!currentPageText) return null;

  // 3. Rendering the Text (Strict substring slices as requested)
  // Ensure bounds are safe
  const validStart = Math.min(Math.max(0, highlightRange.start), currentPageText.length);
  const validEnd = Math.min(Math.max(validStart, highlightRange.end), currentPageText.length);

  const beforeText = currentPageText.substring(0, validStart);
  const highlightedText = currentPageText.substring(validStart, validEnd);
  const afterText = currentPageText.substring(validEnd);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.textWrapper}>
        <Text style={styles.baseText}>
          {beforeText}
          {highlightedText ? <Text style={styles.highlight}>{highlightedText}</Text> : null}
          {afterText}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F0', // Match book theme
  },
  content: {
    padding: 20,
    paddingTop: 40,
  },
  textWrapper: {
    flex: 1,
  },
  baseText: {
    fontSize: 20,
    color: '#2C2C2C',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    lineHeight: 34,
  },
  highlight: {
    backgroundColor: '#FFEB3B', // Yellow highlighting
    color: '#000',
    overflow: 'hidden', // Required for background styling on Text in RN
  }
});
