import { useEffect, useRef, useState } from 'react';
import { useCookingStore, type PlayerPlaybackState } from '../../store/cookingStore';
import { useYouTubeApi } from './useYouTubeApi';
import { parseYouTubeId } from './youtubeId';

function toPlaybackState(yt: typeof YT, s: YT.PlayerState): PlayerPlaybackState {
  switch (s) {
    case yt.PlayerState.PLAYING:
      return 'playing';
    case yt.PlayerState.PAUSED:
      return 'paused';
    case yt.PlayerState.ENDED:
      return 'ended';
    case yt.PlayerState.BUFFERING:
      return 'buffering';
    case yt.PlayerState.CUED:
      return 'cued';
    default:
      return 'unstarted';
  }
}

const STATE_LABEL: Record<PlayerPlaybackState, string> = {
  unstarted: '대기',
  ended: '종료',
  playing: '재생 중',
  paused: '일시정지',
  buffering: '버퍼링',
  cued: '준비됨',
};

/**
 * YouTube IFrame Player. 명령은 스토어의 playerApi를 통해서만 플레이어를 만진다.
 * 브라우저 자동재생 정책: 제스처로 부르는 playVideo()는 사용자 입력이 아니므로
 * 페이지에서 아직 아무 클릭도 하지 않았다면 막힐 수 있다. 카메라 시작 버튼 클릭이 보통 그 조건을 채운다.
 */
export function YouTubePlayer() {
  const yt = useYouTubeApi();
  const videoId = useCookingStore((s) => s.videoId);
  const playerReady = useCookingStore((s) => s.playerReady);
  const playerState = useCookingStore((s) => s.playerState);
  const setVideoId = useCookingStore((s) => s.setVideoId);
  const hostRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState(videoId);
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    if (!yt || !hostRef.current) return;
    const store = useCookingStore.getState();
    // YT.Player는 대상 요소를 iframe으로 교체하므로 자식 div를 만들어 넘긴다
    const mount = document.createElement('div');
    hostRef.current.appendChild(mount);
    const player = new yt.Player(mount, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        enablejsapi: 1,
        playsinline: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          store.setPlayerApi({
            play: () => player.playVideo(),
            pause: () => player.pauseVideo(),
            getState: () => toPlaybackState(yt, player.getPlayerState()),
          });
          store.setPlayerReady(true);
        },
        onStateChange: (e) => store.setPlayerState(toPlaybackState(yt, e.data)),
      },
    });
    return () => {
      store.setPlayerApi(null);
      store.setPlayerReady(false);
      try {
        player.destroy();
      } catch {
        // 아직 iframe이 만들어지기 전에 언마운트되면 destroy가 실패할 수 있다
      }
      mount.remove();
    };
  }, [yt, videoId]);

  const apply = () => {
    const id = parseYouTubeId(input);
    if (!id) {
      setInputError('YouTube 영상 ID나 URL을 인식하지 못했습니다.');
      return;
    }
    setInputError(null);
    setVideoId(id);
  };

  return (
    <div className="yt">
      <div className="yt-frame">
        <div ref={hostRef} className="yt-host" />
        {!yt && <div className="yt-placeholder">YouTube API 로드 중…</div>}
      </div>
      <div className="yt-controls">
        <span className={`yt-state ${playerState === 'playing' ? 'is-on' : ''}`}>
          {playerReady ? STATE_LABEL[playerState] : '플레이어 준비 중'}
        </span>
        <input
          className="yt-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          placeholder="YouTube 영상 ID 또는 URL"
          aria-label="YouTube 영상 ID 또는 URL"
        />
        <button type="button" onClick={apply}>
          영상 바꾸기
        </button>
        {inputError && <span className="yt-error">{inputError}</span>}
      </div>
    </div>
  );
}
