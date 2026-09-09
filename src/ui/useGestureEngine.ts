import { useEffect, useRef } from 'react';
import { detectDynamic } from '../gesture/dynamic';
import { GesturePipeline, type PipelineOutput } from '../gesture/pipeline';
import type { GestureEvent } from '../gesture/stateMachine';
import type { DynamicDetector } from '../gesture/pipeline';
import type { GestureId } from '../gesture/types';
import { useGestureStore } from '../store/gestureStore';
import { useModeStore, type GestureGate } from '../store/modeStore';
import type { VisionSession } from '../vision/session';

export interface EngineHandlers {
  /** 실행된 제스처. fist 토글은 여기서 처리하지 않고 엔진이 직접 enabled를 뒤집는다 (D-015 결정 1). */
  onExecute?: (gesture: GestureId, t: number) => void;
  /** 모드 게이트(대기 모드, 전환 직후)에 막힌 실행. 주먹도 포함된다 (D-016) */
  onBlocked?: (gesture: GestureId, gate: Extract<GestureGate, { blocked: true }>, t: number) => void;
  onEvents?: (events: GestureEvent[], out: PipelineOutput) => void;
  detectDynamic?: DynamicDetector;
}

const HUD_THROTTLE_MS = 66;

/**
 * VisionSession 프레임 → GesturePipeline → 스토어(HUD)·핸들러.
 * React 렌더 밖에서 매 프레임 돌고, HUD만 초당 ~15회 스토어에 반영한다.
 * 모드가 바뀌면 pipeline.reset()(궤적 clear + 상태 초기화)을 호출한다. gesture/ 는 수정하지 않는다.
 */
export function useGestureEngine(session: VisionSession, handlers: EngineHandlers = {}): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const pipeline = new GesturePipeline({
      getConfig: () => useGestureStore.getState().config,
      getEnabled: () => useGestureStore.getState().enabled,
      // 핸들러가 검출기를 주면 그것을, 아니면 기본 detectDynamic을 쓴다
      detectDynamic: (frames, now, cfg) => (handlersRef.current.detectDynamic ?? detectDynamic)(frames, now, cfg),
    });

    let lastHudAt = 0;
    const unsubscribe = session.onFrame(({ frame, t }) => {
      const out = pipeline.process(frame, t);
      const store = useGestureStore.getState();

      if (out.executed) {
        const gate = useModeStore.getState().gate();
        if (gate.blocked) {
          // 대기 모드·전환 직후: 주먹 토글도 건너뛴다
          handlersRef.current.onBlocked?.(out.executed, gate, t);
        } else {
          if (out.executed === 'fist') store.toggleEnabled();
          handlersRef.current.onExecute?.(out.executed, t);
        }
      }
      if (out.events.length > 0) handlersRef.current.onEvents?.(out.events, out);

      if (out.executed || out.events.length > 0 || t - lastHudAt >= HUD_THROTTLE_MS) {
        store.setHud(out.hud);
        lastHudAt = t;
      }
    });

    const unsubStatus = session.onStatus((status) => {
      if (status !== 'running') {
        pipeline.reset();
        useGestureStore.getState().setHud(pipeline.process(null, performance.now()).hud);
      }
    });

    // 모드 전환: 남은 궤적·유지 상태를 비운다 (전환 직전 동작이 새 모드에서 실행되지 않도록)
    let lastMode = useModeStore.getState().current;
    const unsubMode = useModeStore.subscribe((s) => {
      if (s.current === lastMode) return;
      lastMode = s.current;
      pipeline.reset();
    });

    return () => {
      unsubscribe();
      unsubStatus();
      unsubMode();
    };
  }, [session]);
}
