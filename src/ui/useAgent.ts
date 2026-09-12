import { useEffect, useRef } from 'react';
import { AgentClient, agentUrl } from '../agent/client';
import { setAsyncFailureHandler, setKeyTransport } from '../agent/dispatch';
import { describeAgentError, type PanelState } from '../agent/protocol';
import { useAgentStore } from '../store/agentStore';
import { useGestureStore } from '../store/gestureStore';
import { useLogStore } from '../store/logStore';
import { useModeStore } from '../store/modeStore';
import { useProfileStore } from '../store/profileStore';

export interface AgentControls {
  retry: () => void;
}

const PANEL_THROTTLE_MS = 100;

/**
 * 에이전트 클라이언트 수명 관리 + 실행 출구 등록 + panel 상태 전송 + 긴급 정지 처리.
 * 포트는 활성 프로필 설정(agentPort). 바뀌면 재연결한다.
 */
export function useAgent(): AgentControls {
  const clientRef = useRef<AgentClient | null>(null);
  const port = useProfileStore((s) => (s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0]).settings.agentPort);

  useEffect(() => {
    const store = useAgentStore.getState();
    const log = useLogStore.getState();
    const client = new AgentClient({
      onStatus: (status, detail) => useAgentStore.getState().setStatus(status, detail),
      onHello: (h) => {
        useAgentStore.getState().setHello(h);
        log.add({ subject: '에이전트', result: 'executed', command: '연결', note: `${h.agent ?? 'agent'} · ${h.platform} · ${h.capabilities.join('/')}` });
      },
      onPermissions: (p) => {
        useAgentStore.getState().setPermissions(p);
        log.add({ subject: '에이전트', result: 'executed', command: '권한 변경', note: `손쉬운 사용 ${p.accessibility ? '허용' : '없음'}` });
      },
      onPanic: () => {
        useAgentStore.getState().setPanic(Date.now());
        useModeStore.getState().standby('agent');
        log.add({ subject: '에이전트', result: 'executed', command: '긴급 정지', note: 'MOTION OFF 로 전환' });
      },
    });
    clientRef.current = client;

    setKeyTransport({
      canSend: () => client.canSend('key'),
      platform: () => (client.platform === 'linux' ? 'win32' : client.platform),
      sendKey: (combo) => client.request({ type: 'key', combo }),
    });
    setAsyncFailureHandler(({ combo, error }) => {
      const [code, ...rest] = error.split(': ');
      const label = describeAgentError(code, rest.join(': ') || undefined);
      useAgentStore.getState().setLastError(label);
      useLogStore.getState().add({ subject: '에이전트', result: 'failed', command: `key ${combo}`, reason: label });
    });

    const url = agentUrl(port);
    store.setUrl(url);
    client.connect(url);

    // panel 상태: 바뀔 때만, 최대 10/s
    let lastSent = '';
    let lastAt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const buildPanel = (): PanelState => {
      const mode = useModeStore.getState().current;
      const g = useGestureStore.getState();
      const profile = useProfileStore.getState().active();
      return {
        mode,
        motion: mode === 'standby' ? 'off' : 'on',
        camera: g.visionStatus === 'running' ? 'on' : 'off',
        candidate: g.hud.candidate ?? null,
        progress: g.hud.progress,
        lastCommand: useLogStore.getState().entries.find((e) => e.result === 'executed' && e.gesture)?.command ?? null,
        laser: profile.settings.laser,
      };
    };
    const flush = () => {
      timer = null;
      if (!client.canSend('panel')) return;
      const state = buildPanel();
      const key = JSON.stringify(state);
      if (key === lastSent) return;
      lastSent = key;
      lastAt = Date.now();
      client.request({ type: 'panel', state }).catch(() => undefined);
    };
    const schedule = () => {
      if (timer) return;
      const wait = Math.max(0, PANEL_THROTTLE_MS - (Date.now() - lastAt));
      timer = setTimeout(flush, wait);
    };
    const unsubs = [useModeStore.subscribe(schedule), useGestureStore.subscribe(schedule), useAgentStore.subscribe((s, prev) => s.status === 'ready' && prev.status !== 'ready' && schedule())];

    return () => {
      unsubs.forEach((u) => u());
      if (timer) clearTimeout(timer);
      setKeyTransport(null);
      setAsyncFailureHandler(null);
      client.disconnect();
      clientRef.current = null;
    };
  }, [port]);

  return { retry: () => clientRef.current?.retryNow() };
}
