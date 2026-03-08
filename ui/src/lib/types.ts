// ============================================
// SeaClip Shared TypeScript Types
// ============================================

export type AgentStatus = "idle" | "running" | "error" | "offline" | "paused";
export type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done";
export type IssuePriority = "urgent" | "high" | "medium" | "low";
export type DeviceStatus = "online" | "offline" | "degraded";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type AdapterType = "openai" | "anthropic" | "gemini" | "ollama" | "custom";
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
  lastHeartbeatAt: string | null;
  deviceId?: string;
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
  type: string;
  requesterId: string;
  requesterName: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  resolvedBy?: string;
  resolvedAt?: string;
  reason?: string;
  createdAt: string;
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
