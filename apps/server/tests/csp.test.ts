import { describe, it, expect } from 'vitest';
import { executeEngineOptimization } from '../src/engine/csp_solver_worker.js';
import type { PlanningRoomSession } from '@tgn/shared';

console.log('[TEST FILE] csp.test.ts loaded');

describe('The Group Nightmare - CSP Engine', () => {
  it('should respect the architecture and return a solution before the 28s timeout', async () => {
    console.log('[TEST] Starting test case...');
    const mockSession: PlanningRoomSession = {
      roomId: 'test-timeout-room',
      createdAt: new Date().toISOString(),
      participants: [
        { id: 'p1', displayName: 'Or', isOnline: true, joinedAt: '', cursorColor: '#000' }
      ],
      constraintsMatrix: {},
      latestSolverResult: null,
      isSolving: true
    };

    console.log('[TEST] Calling executeEngineOptimization...');
    const result = await executeEngineOptimization(mockSession);
    console.log('[TEST] executeEngineOptimization returned result:', result);
    
    expect(result).toBeDefined();
    expect(result.solverDurationMs).toBeLessThan(28000); 
    console.log('[TEST] Assertions passed!');
  });
});
