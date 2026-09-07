import { useMemo } from 'react';
import { CameraView } from './ui/CameraView';
import { VisionSession } from './vision/session';

export default function App() {
  const session = useMemo(() => new VisionSession(), []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>모션 단축키</h1>
        <span className="app-subtitle">요리 모드 · 1차 초안</span>
      </header>
      <main className="layout">
        <section className="panel panel-left">
          <CameraView session={session} />
        </section>
        <section className="panel panel-right">
          <p className="placeholder">요리 모드 UI는 7단계에서 붙습니다.</p>
        </section>
      </main>
    </div>
  );
}
