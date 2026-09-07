export interface RecipeStep {
  title: string;
  detail: string;
  /** 참고용 소요 시간 문구 (타이머와 연동하지 않음) */
  time?: string;
}

export interface Recipe {
  title: string;
  /** YouTube 영상 ID. UI에서 바꿀 수 있다 */
  videoId: string;
  steps: RecipeStep[];
}

/**
 * 하드코딩된 샘플 레시피. 영상은 Good Morning America의
 * "Gordon Ramsay's perfect scrambled eggs tutorial" (ID는 oEmbed로 존재 확인, 2026-09-07).
 */
export const SAMPLE_RECIPE: Recipe = {
  title: '고든 램지식 스크램블드 에그',
  videoId: 'VhJFyyukAzA',
  steps: [
    {
      title: '재료 준비',
      detail: '달걀 3개, 버터 1큰술, 크렘 프레슈(또는 사워크림) 1작은술, 소금·후추, 차이브 약간. 냄비는 작은 소스팬을 쓴다.',
      time: '2분',
    },
    {
      title: '달걀과 버터를 찬 팬에',
      detail: '불을 켜기 전에 달걀을 깨 넣고 버터를 함께 넣는다. 미리 풀지 않는다.',
      time: '1분',
    },
    {
      title: '중불에서 계속 젓기',
      detail: '실리콘 주걱으로 바닥을 긁듯 쉬지 않고 젓는다. 30초 불 위, 10초 불 밖을 반복한다.',
      time: '3분',
    },
    {
      title: '불에서 내려 마무리',
      detail: '촉촉한 커스터드 질감이 되면 불에서 내리고 크렘 프레슈를 넣어 잔열을 멈춘다.',
      time: '30초',
    },
    {
      title: '간하기',
      detail: '소금과 후추는 마지막에. 일찍 넣으면 달걀이 묽어진다. 차이브를 뿌린다.',
      time: '30초',
    },
    {
      title: '플레이팅',
      detail: '구운 빵 위에 올려 바로 낸다. 식으면 질감이 변하니 지체하지 않는다.',
      time: '1분',
    },
  ],
};
