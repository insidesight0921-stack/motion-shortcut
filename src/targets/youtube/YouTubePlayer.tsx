import { useEffect, useId, useRef, useState } from 'react';
import { useTargetStore, type PlayerPlaybackState } from '../../store/targetStore';
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
 * 미디어 명령(media.*)의 데모 대상. YouTube IFrame Player.
 * 명령은 스토어의 playerApi(play/pause/seekTo/getCurrentTime)를 통해서만 플레이어를 만진다.
 * 브라우저 자동재생 정책: 제스처로 부르는 playVideo()는 사용자 입력이 아니므로
 * 페이지에서 아직 아무 클릭도 하지 않았다면 막힐 수 있다. 카메라 시작 버튼 클릭이 보통 그 조건을 채운다.
 */
export function YouTubePlayer() {
  const yt = useYouTubeApi();
  const videoId = useTargetStore((s) => s.videoId);
  const playerReady = useTargetStore((s) => s.playerReady);
  const playerState = useTargetStore((s) => s.playerState);
  const setVideoId = useTargetStore((s) => s.setVideoId);
  const hostRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState(videoId);
  const [inputError, setInputError] = useState<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    if (!yt || !hostRef.current) return;
    const store = useTargetStore.getState();
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
            getCurrentTime: () => player.getCurrentTime(),
            getDuration: () => player.getDuration(),
            seekTo: (seconds) => player.seekTo(seconds, true),
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
      setInputError('YouTube 영상 ID(11자)나 youtube.com / youtu.be 주소만 인식합니다.');
      return;
    }
    setInputError(null);
    setVideoId(id);
  };

  return (
    <section className="card" aria-labelledby="yt-title">
      <div className="card-head">
        <h2 id="yt-title" className="t-title-3">
          미디어 · YouTube
        </h2>
        <span className="t-caption t-muted">{playerReady ? STATE_LABEL[playerState] : yt ? '플레이어 준비 중' : '플레이어 불러오는 중'}</span>
      </div>

      <div className="yt-frame">
        <div ref={hostRef} className="yt-host" />
        {!playerReady && <div className="skeleton yt-skeleton" aria-hidden />}
      </div>

      <form
        className="yt-form field"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <label htmlFor={inputId} className="field-label">
          YouTube 영상 ID 또는 URL
        </label>
        <div className="yt-form-row">
          <input
            id={inputId}
            className={`input ${inputError ? 'is-invalid' : ''}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-invalid={inputError ? true : undefined}
            aria-describedby={`${inputId}-error`}
          />
          <button type="submit" className="btn btn-secondary">
            영상 바꾸기
          </button>
        </div>
        <p id={`${inputId}-error`} className="field-error" aria-live="polite">
          {inputError ?? ''}
        </p>
      </form>
    </section>
  );
}
