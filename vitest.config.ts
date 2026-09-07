import { defineConfig } from 'vitest/config';

// 인식 로직은 순수 함수라 DOM 없이 node 환경에서 테스트한다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
