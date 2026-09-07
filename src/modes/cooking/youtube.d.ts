// @types/youtube는 YT 네임스페이스만 선언하고 iframe_api가 호출하는 전역 콜백은 선언하지 않는다.
interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
