import { useEffect, useRef } from 'react';
import EventSource from 'react-native-sse';
import AsyncStorage from '@react-native-async-storage/async-storage';

let globalEventSource = null;
let subscribers = new Set();
let reconnectTimer = null;

let pendingPayloads = [];
let debounceTimer = null;

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api';

async function connectSSE() {
  if (globalEventSource) return;
  const token = await AsyncStorage.getItem('jwtToken');
  
  globalEventSource = new EventSource(`${API_BASE}/realtime?token=${token}`);
  
  globalEventSource.addEventListener('message', (e) => {
    try {
      if (!e.data) return;
      const data = JSON.parse(e.data);
      pendingPayloads.push(data);
      
      if (!debounceTimer) {
        debounceTimer = setTimeout(() => {
          const payloadsToUpdate = [...pendingPayloads];
          pendingPayloads = [];
          debounceTimer = null;
          
          subscribers.forEach(sub => {
            const relevantPayloads = payloadsToUpdate.filter(p => sub.tables.includes(p.table));
            if (relevantPayloads.length > 0) {
              sub.callback({ ...relevantPayloads[relevantPayloads.length - 1].payload, bulk: true, payloads: relevantPayloads });
            }
          });
        }, 500);
      }
    } catch(err) {
      console.error('Failed to parse SSE message', err);
    }
  });

  globalEventSource.addEventListener('error', () => {
    if (globalEventSource) {
      globalEventSource.close();
    }
    globalEventSource = null;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectSSE, 3000);
  });
}

export function useRealtime(tables, onUpdate) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const tableDeps = tables ? tables.join(',') : '';
  
  useEffect(() => {
    if (!tables || tables.length === 0) return;
    
    const sub = { 
      tables, 
      callback: (payload) => {
        if (onUpdateRef.current) onUpdateRef.current(payload);
      }
    };
    
    subscribers.add(sub);
    connectSSE();

    return () => {
      subscribers.delete(sub);
      if (subscribers.size === 0 && globalEventSource) {
        globalEventSource.close();
        globalEventSource = null;
        clearTimeout(reconnectTimer);
      }
    };
  }, [tableDeps]);
}
