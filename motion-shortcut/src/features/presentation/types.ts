export type PresentationMode = "slide" | "cursor" | "laser";

export type PresentationApp =
  | "powerpoint"
  | "keynote"
  | "google-slides"
  | "web-slides";

export type GesturePattern =
  | "swipe-right"
  | "swipe-left"
  | "index"
  | "victory"
  | "open-palm"
  | "fist"
  | "thumbs-up"
  | "thumbs-down"
  | "ok"
  | "three-fingers"
  | "point-left"
  | "point-right"
  | "point-up";

export type PresentationAction =
  | "next-slide"
  | "previous-slide"
  | "black-screen"
  | "exit-presentation"
  | "resource-1"
  | "resource-2";

export type ResourceKind = "url" | "file" | "app";

export interface PresentationResource {
  id: string;
  name: string;
  kind: ResourceKind;
  value: string;
  returnAfterMs?: number;
}

export interface KeyShortcut {
  key: string;
  modifiers: Array<"Meta" | "Control" | "Alt" | "Shift">;
}

export interface PresentationProfile {
  id: string;
  name: string;
  app: PresentationApp;
  presentationUrl: string;
  mappings: Record<PresentationAction, GesturePattern | "">;
  shortcuts: Partial<Record<PresentationAction, KeyShortcut>>;
  resources: PresentationResource[];
}

export const GESTURE_OPTIONS: Array<{ id: GesturePattern; label: string }> = [
  { id: "swipe-right", label: "오른쪽 스와이프" },
  { id: "swipe-left", label: "왼쪽 스와이프" },
  { id: "index", label: "검지 하나" },
  { id: "victory", label: "V 사인" },
  { id: "open-palm", label: "손바닥 펼치기" },
  { id: "fist", label: "주먹 쥐기" },
  { id: "thumbs-up", label: "엄지 위" },
  { id: "thumbs-down", label: "엄지 아래" },
  { id: "ok", label: "OK 사인" },
  { id: "three-fingers", label: "세 손가락 (엄지·검지·새끼)" },
  { id: "point-left", label: "왼쪽 가리키기" },
  { id: "point-right", label: "오른쪽 가리키기" },
  { id: "point-up", label: "위 가리키기" },
];

export const ACTION_LABELS: Record<PresentationAction, string> = {
  "next-slide": "다음 슬라이드",
  "previous-slide": "이전 슬라이드",
  "black-screen": "화면 가리기",
  "exit-presentation": "발표 종료",
  "resource-1": "자료 1 열기",
  "resource-2": "자료 2 열기",
};
