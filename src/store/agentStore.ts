import { create } from 'zustand';
import type { AgentStatus } from '../agent/client';
import type { AgentPermissions, AgentPlatform, Capability } from '../agent/protocol';

interface AgentState {
  status: AgentStatus;
  detail?: string;
  url: string;
  agentName?: string;
  platform: AgentPlatform | null;
  capabilities: Capability[];
  permissions: AgentPermissions | null;
  /** 에이전트 긴급 정지 수신 시각. 해제(permissions 수신)까지 표시 */
  panicAt: number | null;
  lastError?: string;

  setStatus: (status: AgentStatus, detail?: string) => void;
  setHello: (h: { agent?: string; platform: AgentPlatform; capabilities: Capability[]; permissions: AgentPermissions }) => void;
  setPermissions: (p: AgentPermissions) => void;
  setPanic: (at: number | null) => void;
  setUrl: (url: string) => void;
  setLastError: (e?: string) => void;
}

/** 에이전트 연결 상태 (표시용). 실제 소켓은 ui/useAgent.ts 가 갖는다 */
export const useAgentStore = create<AgentState>((set) => ({
  status: 'disconnected',
  url: '',
  platform: null,
  capabilities: [],
  permissions: null,
  panicAt: null,

  setStatus: (status, detail) =>
    set((s) =>
      status === 'ready'
        ? { status, detail }
        : // ready 가 아니면 능력 목록은 비운다. hello 대기 중에는 이전 플랫폼 표시를 잠깐 유지
          { status, detail, platform: status === 'hello_wait' ? s.platform : null, capabilities: [] },
    ),
  setHello: (h) => set({ agentName: h.agent, platform: h.platform, capabilities: h.capabilities, permissions: h.permissions, lastError: undefined }),
  setPermissions: (permissions) => set({ permissions, panicAt: null }),
  setPanic: (panicAt) => set({ panicAt }),
  setUrl: (url) => set({ url }),
  setLastError: (lastError) => set({ lastError }),
}));

export function isAgentReady(): boolean {
  return useAgentStore.getState().status === 'ready';
}
