import { useEffect, useRef } from 'react';
import { detectDynamic } from '../gesture/dynamic';
import { createMotionToggleState, stepMotionToggle } from '../gesture/modeGesture';
import { GesturePipeline, type PipelineOutput } from '../gesture/pipeline';
import type { GestureEvent } from '../gesture/stateMachine';
import type { DynamicDetector } from '../gesture/pipeline';
import { classifyTwoHandPose, pairHands, pickPrimaryHand, type TwoHandPose } from '../gesture/twoHands';
import type { GestureId } from '../gesture/types';
import { useGestureStore } from '../store/gestureStore';
import { useModeStore } from '../store/modeStore';
import { useProfileStore } from '../store/profileStore';
import type { VisionSession } from '../vision/session';

export type BlockReason = 'MOTION OFF' | '모드 전환 직후' | '양손 제스처 진행 중' | '주먹 토글 비활성(설정)';

export interface EngineHandlers {
  /** 실행된 제스처. fist 토글은 여기서 처리하지 않고 엔진이 직접 enabled를 뒤집는다 (D-015 결정 1). */
  onExecute?: (gesture: GestureId, t: number) => void;
  /** 게이트에 막힌 실행 (MOTION OFF, 전환 직후, 양손 진행 중, 주먹 옵션 꺼짐). 주먹도 포함 */
  onBlocked?: (gesture: GestureId, reason: BlockReason, t: number) => void;
  /** 양손 제스처 실행 (1차: x_cross = MOTION OFF 토글) */
  onTwoHand?: (pose: TwoHandPose, t: number) => void;
  onEvents?: (events: GestureEvent[], out: PipelineOutput) => void;
  detectDynamic?: DynamicDetector;
}

const HUD_THROTTLE_MS = 66;

/**
 * VisionSession 프레임 → (양손 판정) + GesturePipeline → 스토어(HUD)·핸들러.
 *  - 두 손이 보이면 양손 포즈를 먼저 본다. 양손 X 유지 → MOTION OFF 토글 (settings.motionToggle === 'x_cross')
 *  - 양손 포즈가 진행 중이면 한 손 실행은 막는다
 *  - 한 손 파이프라인에는 설정된 주 손(activeHand)을 넣는다. 한 손만 보이면 기존 경로 그대로
 *  - 모드가 바뀌면 pipeline.reset(). gesture/ 는 수정하지 않는다
 */
export function useGestureEngine(session: VisionSession, handlers: EngineHandlers = {}): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const pipeline = new GesturePipeline({
      getConfig: () => useGestureStore.getState().config,
      getEnabled: () => useGestureStore.getState().enabled,
      detectDynamic: (frames, now, cfg) => (handlersRef.current.detectDynamic ?? detectDynamic)(frames, now, cfg),
    });
    let toggleState = createMotionToggleState();

    let lastHudAt = 0;
    const unsubscribe = session.onFrame(({ hands, t }) => {
      const store = useGestureStore.getState();
      const cfg = store.config;
      const settings = useProfileStore.getState().active().settings;

      // ---- 양손 ----
      const pair = pairHands(hands);
      const two = pair ? classifyTwoHandPose(pair, cfg) : null;
      const xActive = !!two && two.pose === 'x_cross' && two.score >= cfg.twoHandMinScore && settings.motionToggle === 'x_cross';
      const mt = stepMotionToggle(toggleState, { t, active: xActive }, cfg);
      toggleState = mt.state;
      if (mt.toggled) {
        useModeStore.getState().toggleStandby('gesture');
        handlersRef.current.onTwoHand?.('x_cross', t);
      }
      const twoHandBusy = toggleState.phase === 'holding' || (two?.pose != null && two.score >= cfg.twoHandMinScore);

      // ---- 한 손 ----
      const primary = pickPrimaryHand(hands, settings.activeHand);
      const out = pipeline.process(primary, t);

      if (out.executed) {
        const gesture = out.executed;
        const gate = useModeStore.getState().gate();
        if (gate.blocked) {
          handlersRef.current.onBlocked?.(gesture, gate.reason, t);
        } else if (twoHandBusy) {
          handlersRef.current.onBlocked?.(gesture, '양손 제스처 진행 중', t);
        } else if (gesture === 'fist' && settings.motionToggle !== 'fist') {
          handlersRef.current.onBlocked?.(gesture, '주먹 토글 비활성(설정)', t);
        } else {
          if (gesture === 'fist') store.toggleEnabled();
          handlersRef.current.onExecute?.(gesture, t);
        }
      }
      if (out.events.length > 0) handlersRef.current.onEvents?.(out.events, out);

      if (out.executed || mt.toggled || out.events.length > 0 || t - lastHudAt >= HUD_THROTTLE_MS) {
        store.setHud(out.hud);
        store.setTwoHand(
          hands.length >= 2
            ? { pose: two?.pose ?? null, progress: toggleState.progress, holding: toggleState.phase === 'holding', hands: hands.map((h) => h.hand ?? '?') }
            : hands.length === 1
              ? { pose: null, progress: 0, holding: false, hands: [hands[0].hand ?? '?'] }
              : null,
        );
        lastHudAt = t;
      }
    });

    const unsubStatus = session.onStatus((status) => {
      if (status !== 'running') {
        pipeline.reset();
        toggleState = createMotionToggleState();
        useGestureStore.getState().setHud(pipeline.process(null, performance.now()).hud);
        useGestureStore.getState().setTwoHand(null);
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
