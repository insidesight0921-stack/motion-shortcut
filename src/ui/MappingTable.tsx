import type { Mode } from '../commands/types';
import type { GestureId } from '../gesture/types';
import { useGestureStore } from '../store/gestureStore';
import { GESTURE_LABEL } from './Hud';

interface Props {
  mode: Mode;
}

const ORDER: GestureId[] = ['open_palm', 'swipe_right', 'swipe_left', 'circle', 'fist'];

/** 제스처 ↔ 명령 매핑 표 (읽기 전용). 유지 시간은 현재 설정값을 보여 준다. */
export function MappingTable({ mode }: Props) {
  const cfg = useGestureStore((s) => s.config);

  const how: Record<GestureId, string> = {
    open_palm: `다섯 손가락 편 채 ${(cfg.palmHoldMs / 1000).toFixed(1)}초 유지`,
    fist: `주먹 쥔 채 ${(cfg.fistHoldMs / 1000).toFixed(1)}초 유지 (비활성 상태에서도 인식)`,
    swipe_right: `${cfg.swipeWindowMs / 1000}초 안에 사용자 오른쪽으로 손 크기 ${cfg.swipeMinDistance}배 이동`,
    swipe_left: `${cfg.swipeWindowMs / 1000}초 안에 사용자 왼쪽으로 손 크기 ${cfg.swipeMinDistance}배 이동`,
    circle: `검지 끝으로 ${cfg.circleWindowMs / 1000}초 안에 ${cfg.circleMinAngleDeg}° 이상 회전`,
  };

  return (
    <div className="mapping">
      <h3>제스처 ↔ 명령 ({mode.name})</h3>
      <table className="mapping-table">
        <thead>
          <tr>
            <th>제스처</th>
            <th>종류</th>
            <th>명령</th>
            <th>인식 조건</th>
          </tr>
        </thead>
        <tbody>
          {ORDER.map((g) => {
            const cmdId = mode.mapping[g];
            const label = cmdId ? mode.commands[cmdId].label : '모션 단축키 활성화 on/off';
            const kind = g === 'open_palm' || g === 'fist' ? '정적' : '동적';
            return (
              <tr key={g}>
                <td>{GESTURE_LABEL[g]}</td>
                <td>{kind}</td>
                <td>{label}</td>
                <td className="muted">{how[g]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">방향 기준은 사용자 시점입니다. 미리보기가 거울 모드이므로 화면에서 보이는 방향과 같습니다.</p>
    </div>
  );
}
