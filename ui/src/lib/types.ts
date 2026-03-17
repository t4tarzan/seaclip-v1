// ============================================
// SeaClip Shared TypeScript Types
// ============================================

export type AgentStatus = "idle" | "active" | "running" | "error" | "offline" | "paused";
export type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done";
export type IssuePriority = "urgent" | "high" | "medium" | "low";
export type DeviceStatus = "online" | "offline" | "degraded";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type AdapterType =
  // Cloud LLM providers
  | "openai"
  | "anthropic"
  | "openrouter"
  | "litellm"
  // Local / Hub models
  | "ollama_local"
  | "claude_code"
  // Edge / Spoke agents
  | "seaclaw"
  | "agent_zero"
  | "external_agent"
  // Infrastructure
  | "telegram_bridge"
  | "process"
  | "http";
export type DeviceType = "raspberry_pi" | "jetson" | "phone" | "camera" | "mac" | "linux" | "windows";

export interface Company {
  id: string;
  name: string;
  description: string;
  apiKey: string;
  deploymentMode: "cloud" | "hybrid" | "edge";
  monthlyBudgetCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title: string;
  adapterType: AdapterType;
  config: Record<string, unknown>;
  status: AgentStatus;
  budgetCents: number;
  spentCents: number;
  totalRuns?: number;
  lastHeartbeatAt: string | null;
  lastRunAt?: string | null;
  deviceId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  taskCounts?: { openTasks: number; doneTasks: number; totalTasks: number };
  createdAt: string;
  updatedAt: string;
}

export interface HeartbeatRun {
  id: string;
  agentId: string;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "completed" | "failed";
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  result?: string;
  error?: string;
}

export interface Issue {
  id: string;
  identifier: string;
  companyId: string;
  projectId?: string;
  projectName?: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId?: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  goalId?: string;
  goalName?: string;
  metadata?: Record<string, unknown>;
  githubUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssueComment {
  id: string;
  issueId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  body: string;
  createdAt: string;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  color: string;
  issueCount: number;
}

export interface EdgeDevice {
  id: string;
  companyId: string;
  name: string;
  hostname: string;
  deviceType: DeviceType;
  status: DeviceStatus;
  ipAddress: string;
  location?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  telemetry: DeviceTelemetry;
  lastSeenAt: string;
  registeredAt: string;
}

export interface DeviceTelemetry {
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  temperatureCelsius: number;
  networkRxBps: number;
  networkTxBps: number;
  tasksProcessed: number;
  uptime: number;
}

export interface EdgeMesh {
  hubDeviceId: string;
  devices: EdgeDevice[];
  connections: MeshConnection[];
  totalTasksProcessing: number;
  onlineCount: number;
  offlineCount: number;
  degradedCount: number;
}

export interface MeshConnection {
  fromId: string;
  toId: string;
  quality: "healthy" | "degraded" | "offline";
  latencyMs: number;
}

export interface DashboardData {
  agentCounts: Record<string, number>;
  issueCounts: Record<string, number>;
  priorityCounts?: { urgent: number; high: number; medium: number; low: number; none: number };
  heartbeatSuccessRate?: number;
  costs: { last30DaysTotalUsd: number; todayTotalUsd: number };
  edgeDeviceCount: number;
  onlineDeviceCount: number;
  recentActivity: ActivityEvent[];
  generatedAt: string;
}

export interface CostData {
  periodStartDate: string;
  periodEndDate: string;
  totalCents: number;
  byAgent: AgentCost[];
  byDay: DailyCost[];
}

export interface AgentCost {
  agentId: string;
  agentName: string;
  totalCents: number;
  inputTokens: number;
  outputTokens: number;
  runCount: number;
}

export interface DailyCost {
  date: string;
  totalCents: number;
}

export interface Approval {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  agentId?: string;
  requestedById?: string;
  status: ApprovalStatus;
  decision?: "approved" | "rejected";
  reason?: string;
  resolvedById?: string;
  requestedAt: string;
  resolvedAt?: string;
  metadata: Record<string, unknown>;
}

export interface ActivityEvent {
  id: string;
  companyId: string;
  actorId: string;
  actorName: string;
  actorType: "agent" | "user" | "system";
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  detail?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface IssueFilters {
  status?: IssueStatus;
  priority?: IssuePriority;
  projectId?: string;
  assigneeId?: string;
  search?: string;
}

// Goals
export type GoalStatus = "draft" | "active" | "achieved" | "abandoned";
export type MetricType = "boolean" | "numeric" | "percentage";

export interface Goal {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  status: GoalStatus;
  targetDate?: string;
  projectId?: string;
  parentGoalId?: string;
  metricType: MetricType;
  metricTarget?: number;
  metricCurrent: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Sidebar Badges
export interface SidebarBadges {
  pendingApprovals: number;
  activeIssues: number;
  runningAgents: number;
  onlineDevices: number;
  openPRs: number;
  errorAgents: number;
}

// Spoke Tasks & Pull Requests
export type SpokeTaskStatus = "pending" | "assigned" | "in_progress" | "pr_raised" | "merged" | "done";
export type PRStatus = "open" | "merged" | "closed";
export type PRReviewStatus = "pending" | "approved" | "rejected";

export interface SpokeTask {
  id: string;
  companyId: string;
  deviceId: string;
  issueId?: string;
  title: string;
  description?: string;
  repoUrl: string;
  branch?: string;
  worktreePath?: string;
  status: SpokeTaskStatus;
  assignedAt: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequest {
  id: string;
  companyId: string;
  spokeTaskId: string;
  deviceId: string;
  title: string;
  description?: string;
  sourceBranch: string;
  targetBranch: string;
  status: PRStatus;
  reviewStatus: PRReviewStatus;
  diffStat?: Record<string, unknown>;
  reviewedBy?: string;
  reviewedAt?: string;
  mergedAt?: string;
  createdAt: string;
  updatedAt: string;
}
