import type { Program } from '../profile/types';

/**
 * 현재 발표 프로그램을 알려주는 함수 주입점.
 * catalog.ts 가 profileStore 를 직접 import 하면 profileStore → storage → registry → catalog 순환이 생겨
 * 모듈 초기화 중 COMMANDS 가 아직 없을 수 있다. 그래서 스토어가 초기화된 뒤 여기 등록한다.
 */
let provider: () => Program = () => 'powerpoint';

export function setProgramProvider(p: () => Program): void {
  provider = p;
}

export function currentProgram(): Program {
  return provider();
}
