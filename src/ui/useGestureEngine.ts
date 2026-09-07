import { useEffect, useRef } from 'react';
import { GesturePipeline, type PipelineOutput } from '../gesture/pipeline';
import type { GestureEvent } from '../gesture/stateMachine';
import type { DynamicDetector } from '../gesture/pipeline';
import type { GestureId } from '../gesture/types';
import { useGestureStore } from '../store/gestureStore';
import type { VisionSession } from '../vision/session';

export interface EngineHandlers {
  /** 실행된 제스처. fist 토글은 여기서 처리하지 않고 엔진이 직접 enabled를 뒤집는다. */
  onExecute?: (gesture: GestureId, t: number) => void;
  onEvents?: (events: GestureEvent[], out: PipelineOutput) => void;
  detectDynamic?: DynamicDetector;
}

const HUD_THROTTLE_MS = 66;

/**
 * VisionSession 프레임 → GesturePipeline → 스토어(HUD)·핸들러.
 * React 렌더 밖에서 매 프레임 돌고, HUD만 초당 ~15회 스토어에 반영한다.
 */
export function useGestureEngine(session: VisionSession, handlers: EngineHandlers = {}): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const pipeline = new GesturePipeline({
      getConfig: () => useGestureStore.getState().config,
      getEnabled: () => useGestureStore.getState().enabled,
      detectDynamic: (frames, now, cfg) => handlersRef.current.detectDynamic?.(frames, now, cfg) ?? null,
    });

    let lastHudAt = 0;
    const unsubscribe = session.onFrame(({ frame, t }) => {
      const out = pipeline.process(frame, t);
      const store = useGestureStore.getState();

      if (out.executed) {
        if (out.executed === 'fist') store.toggleEnabled();
        handlersRef.current.onExecute?.(out.executed, t);
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

    return () => {
      unsubscribe();
      unsubStatus();
    };
  }, [session]);
}
