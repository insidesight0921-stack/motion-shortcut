import { MODES } from '../modes/catalog';
import type { SwitchSource } from '../modes/types';
import { useLogStore } from '../store/logStore';
import type { ModeSwitch } from '../store/modeStore';

export function describeSource(source: SwitchSource, utterance?: string): string {
  switch (source) {
    case 'voice':
      return utterance ? `음성 "${utterance}"` : '음성';
    case 'ui':
      return '화면';
    case 'key':
      return '키보드';
    case 'init':
      return '초기값';
  }
}

/** 실행 로그: `모드 전환 | media → presentation | 실행 | 음성 "발표 모드"` */
export function logModeSwitch(sw: ModeSwitch): void {
  useLogStore.getState().add({
    subject: '모드 전환',
    result: 'executed',
    command: `${sw.from} → ${sw.to}`,
    note: `${describeSource(sw.source, sw.utterance)} · ${MODES[sw.to].name} 모드`,
    time: sw.at,
  });
}

/** 음성 인식은 됐지만 의도가 없거나 지금 상태에서 쓸 수 없는 발화 */
export function logVoiceIgnored(utterance: string, reason: string): void {
  useLogStore.getState().add({ subject: '음성', result: 'ignored', reason, note: `"${utterance}"` });
}
