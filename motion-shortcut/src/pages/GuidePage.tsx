import { useState } from "react";
import { PreparationDemo } from "../components/PreparationDemo";

const lessons = {
  preparation: {
    label: "발표 준비",
    title: "자료 선택과 추가 자료",
    description: "홈에서 프로필 이름을 정하고 사용할 자료 유형을 선택하세요.",
    steps: [
      [
        "자료 선택",
        "‘데모 덱으로 연습’ 또는 ‘내 PDF 업로드’를 선택한 뒤 ‘발표 시작’을 누르세요. 선택한 자료가 별도의 팝업 발표 창에 열립니다.",
      ],
      [
        "PDF 선택",
        "PDF를 드롭 영역에 놓거나 ‘파일 선택’으로 발표할 파일을 선택하세요. 선택한 파일명을 확인한 뒤 발표를 시작하세요.",
      ],
      [
        "추가 자료",
        "‘추가 자료 추가’로 이름과 URL을 입력하고 ‘새 탭에서 열기’를 누르세요. 자동 복귀 기능은 없습니다.",
      ],
    ],
  },
  camera: {
    label: "카메라와 모션",
    title: "영상 표시와 모션 상태",
    description: "카메라와 모션은 홈의 발표 제어 센터에서 관리합니다.",
    steps: [
      [
        "카메라 켜기",
        "브라우저에서 카메라 접근을 허용하세요. 권한 상태는 설정에서 확인할 수 있습니다.",
      ],
      [
        "표시 방식",
        "카메라가 켜지면 ‘전체 화면’과 ‘손만 보기’를 선택할 수 있습니다. 마지막 선택은 다음 실행에도 유지됩니다.",
      ],
      [
        "모션 ON / OFF",
        "전화 모양의 손동작을 약 1.2초 유지해 모션 상태를 바꿉니다. 카메라는 켜진 상태로 유지됩니다.",
      ],
    ],
  },
  customization: {
    label: "모션·키보드 설정",
    title: "모션·키보드 커스텀",
    description:
      "발표 기능에 사용할 손동작과 키보드 단축키를 원하는 대로 설정하세요.",
    steps: [
      [
        "모션 커스텀",
        "각 기능의 드롭다운에서 사용할 손동작을 선택하세요. 다음·이전 슬라이드, 화면 가리기, 발표 종료에 맞는 동작을 지정할 수 있습니다.",
      ],
      [
        "키보드 커스텀",
        "키 버튼을 누르고 원하는 키를 입력하세요. 일반 키와 Shift 조합을 지정할 수 있고, 중복된 키는 안내가 표시됩니다.",
      ],
      [
        "저장과 초기화",
        "키 설정은 현재 브라우저의 프로필에 저장됩니다. ‘초기화’를 누르면 단축키가 기본값으로 돌아갑니다.",
      ],
    ],
  },
} as const;
type Lesson = keyof typeof lessons;

export function GuidePage() {
  const [selected, setSelected] = useState<Lesson>("preparation");
  const lesson = lessons[selected];
  return (
    <div className="guide-page guide-revised">
      <section
        className="control-panel guide-start"
        aria-labelledby="guide-start-title"
      >
        <h2 id="guide-start-title">웹 화면 사용 순서</h2>
        <ol className="guide-start-steps">
          <li>
            <span aria-hidden="true">01</span>
            <div>
              <h3>홈에서 준비</h3>
              <p>프로필, 자료 유형과 추가 링크를 정리하세요.</p>
              <a href="#/home">홈으로 이동 →</a>
              <PreparationDemo />
            </div>
          </li>
          <li>
            <span aria-hidden="true">02</span>
            <div>
              <h3>입력 방식 설정</h3>
              <p>카메라 권한, 포인터 감도와 커스텀 표를 확인하세요.</p>
              <a href="#/settings">설정 열기 →</a>
              <PreparationDemo variant="settings" />
            </div>
          </li>
        </ol>
      </section>
      <section
        className="control-panel guide-learn"
        aria-labelledby="guide-learn-title"
      >
        <div className="guide-learn-heading">
          <h2 id="guide-learn-title">필요한 사용법 찾기</h2>
        </div>
        <div className="guide-choices" role="group" aria-label="배울 기능 선택">
          {Object.entries(lessons).map(([id, item]) => (
            <button
              key={id}
              aria-pressed={selected === id}
              aria-controls="guide-lesson"
              onClick={() => setSelected(id as Lesson)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          id="guide-lesson"
          className="guide-lesson"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="guide-mode">
            <h3>{lesson.title}</h3>
            <p>{lesson.description}</p>
          </div>
          <div className="guide-actions">
            <dl>
              {lesson.steps.map(([title, description]) => (
                <div key={title}>
                  <div>
                    <dt>{title}</dt>
                    <dd>{description}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
      <aside className="guide-stop" aria-label="제어 멈추기">
        <strong>잠깐 멈추고 싶을 때</strong>
        <p>
          <b>양손 주먹을 약 0.9초</b> 유지하세요. 카메라는 켜둔 채 모션 제어만
          멈춥니다. 다시 사용하려면 <b>전화 모양을 약 1.2초</b> 유지하세요.
        </p>
        <p>
          카메라까지 종료하려면 <b>카메라 끄기</b>를 누르세요.
        </p>
      </aside>

      <section className="guide-details" aria-labelledby="guide-details-title">
        <h2 id="guide-details-title">자주 확인하는 내용</h2>
        <details>
          <summary>발표 시작을 누르면 PDF나 새 발표 창이 열리나요?</summary>
          <div className="guide-detail-body">
            <p>
              네. 선택한 데모 덱이나 PDF가 별도의 팝업 발표 창에 열립니다.
              PDF로 발표하려면 먼저 ‘내 PDF 업로드’에서 파일을 선택하세요.
              창이 열리지 않으면 브라우저에서 이 사이트의 팝업을 허용한 뒤
              ‘발표 시작’을 다시 누르세요.
            </p>
          </div>
        </details>
        <details>
          <summary>추가 자료 링크가 열리지 않아요</summary>
          <div className="guide-detail-body">
            <p>
              http:// 또는 https://로 시작하는 올바른 URL을 입력했는지 확인하세요.
              ‘새 탭에서 열기’를 눌러도 열리지 않으면 브라우저에서 이 사이트의
              팝업 및 리디렉션을 허용한 뒤 다시 시도하세요. 추가 자료를 확인한
              후에는 발표 창을 직접 선택해 돌아오세요.
            </p>
          </div>
        </details>
        <details>
          <summary>카메라가 켜지지 않아요</summary>
          <div className="guide-detail-body">
            <p>
              사이트의 카메라 권한과 다른 프로그램의 카메라 사용 여부를 확인한
              뒤, 설정에서 ‘권한 상태 새로고침’을 누르세요.
            </p>
          </div>
        </details>
      </section>
    </div>
  );
}
