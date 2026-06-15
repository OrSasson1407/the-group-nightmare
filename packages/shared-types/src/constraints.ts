export interface DateRangeConstraint { dateString: string; isAvailable: boolean }
export interface IndividualConstraints { participantId: string; encryptedMaxBudget: string; availabilityGrid: DateRangeConstraint[] }
export interface SolverCandidate { targetDate: string; proposedBudget: number; satisfiedCount: number; totalParticipants: number; complianceScore: number }
export interface SolverOutput { isOptimal: boolean; topCandidates: SolverCandidate[]; solverDurationMs: number }
export interface AvailabilityDelta { participantId: string; dateString: string; isAvailable: boolean }
export interface BudgetDelta { participantId: string; encryptedMaxBudget: string }
