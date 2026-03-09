/**
 * Seed the enhancements table with the full development plan.
 * Run: pnpm tsx scripts/seed-enhancements.ts
 */

const API = "http://localhost:3001/api/enhancements";

interface TaskDef {
  phase: string;
  category: string;
  title: string;
  description: string;
  priority: number;
  sortOrder: number;
  files: string[];
  tests: string[];
  dependsOn: string[]; // titles of dependencies (resolved to IDs after creation)
  children?: TaskDef[];
}

const PLAN: TaskDef[] = [
  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: Sidebar Enhancement
  // ═══════════════════════════════════════════════════════════════════
  {
    phase: "P1-sidebar",
    category: "ui-component",
    title: "Collapsible SidebarAgents section",
    description: "Port Paperclip SidebarAgents: collapsible agent list in sidebar with live run pulse indicators. Show agent name, icon, status dot. Collapsible with chevron toggle.",
    priority: 90,
    sortOrder: 1,
    files: [
      "ui/src/components/SidebarAgents.tsx",
      "ui/src/components/Layout.tsx",
    ],
    tests: ["Agents section renders in sidebar", "Collapse/expand toggles visibility", "Live run indicator pulses for running agents"],
    dependsOn: [],
  },
  {
    phase: "P1-sidebar",
    category: "ui-component",
    title: "Collapsible SidebarProjects section",
    description: "Port Paperclip SidebarProjects: collapsible project list with color dots. Each project links to /projects/:id. Add + button for new project dialog.",
    priority: 85,
    sortOrder: 2,
    files: [
      "ui/src/components/SidebarProjects.tsx",
      "ui/src/components/Layout.tsx",
    ],
    tests: ["Projects section renders with color dots", "Collapse/expand works", "Click navigates to project detail"],
    dependsOn: [],
  },
  {
    phase: "P1-sidebar",
    category: "ui-nav",
    title: "Add Goals, Spokes, PRs nav items to sidebar",
    description: "Add nav items for Goals (/goals), Spoke Tasks (/spoke-tasks), and Pull Requests (/pull-requests) to the sidebar NAV_ITEMS array. Use Target, GitBranch, GitPullRequest icons from lucide.",
    priority: 80,
    sortOrder: 3,
    files: ["ui/src/components/Layout.tsx"],
    tests: ["Goals nav item visible", "Spoke Tasks nav item visible", "Pull Requests nav item visible", "Active state highlights correctly"],
    dependsOn: [],
  },
  {
    phase: "P1-sidebar",
    category: "ui-layout",
    title: "Sidebar section dividers and grouping",
    description: "Group sidebar items into sections: Work (Dashboard, Issues, Goals), Projects (collapsible list), Agents (collapsible list), Spokes (Spoke Tasks, PRs, Edge Mesh), Company (Costs, Approvals, Activity, Settings). Add SidebarSection component with label dividers.",
    priority: 75,
    sortOrder: 4,
    files: [
      "ui/src/components/SidebarSection.tsx",
      "ui/src/components/Layout.tsx",
    ],
    tests: ["Section labels render", "Items grouped correctly"],
    dependsOn: ["Collapsible SidebarAgents section", "Collapsible SidebarProjects section", "Add Goals, Spokes, PRs nav items to sidebar"],
  },
  {
    phase: "P1-sidebar",
    category: "api",
    title: "Sidebar badges API endpoint",
    description: "Create GET /api/companies/:id/sidebar-badges returning { pendingApprovals, activeIssues, runningAgents, onlineDevices, openPRs }. Used by sidebar to show badge counts.",
    priority: 70,
    sortOrder: 5,
    files: [
      "server/src/routes/sidebar-badges.ts",
      "server/src/services/sidebar-badges.ts",
      "server/src/app.ts",
    ],
    tests: ["Returns correct pending approval count", "Returns correct running agent count", "Returns 0 when no data"],
    dependsOn: [],
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Kanban Board + Issues Enhancement
  // ═══════════════════════════════════════════════════════════════════
  {
    phase: "P2-kanban",
    category: "ui-component",
    title: "KanbanBoard component with drag-and-drop",
    description: "Port Paperclip KanbanBoard using @dnd-kit/core + @dnd-kit/sortable. Columns: backlog, todo, in_progress, in_review, done. Draggable cards show identifier, title, priority icon, assignee. onUpdateIssue callback fires on column change.",
    priority: 90,
    sortOrder: 1,
    files: [
      "ui/src/components/KanbanBoard.tsx",
      "ui/src/components/StatusIcon.tsx",
      "ui/src/components/PriorityIcon.tsx",
    ],
    tests: ["Renders 5 columns", "Cards appear in correct column", "Drag card to different column calls onUpdateIssue", "Empty column shows droppable area"],
    dependsOn: [],
    children: [
      {
        phase: "P2-kanban",
        category: "deps",
        title: "Install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities",
        description: "pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities --filter @seaclip/ui",
        priority: 95,
        sortOrder: 0,
        files: ["ui/package.json"],
        tests: ["Package installs without errors"],
        dependsOn: [],
      },
    ],
  },
  {
    phase: "P2-kanban",
    category: "ui-page",
    title: "Issues page: list/board view toggle",
    description: "Add toggle button group (List | Board) to Issues page header. List view = current table. Board view = KanbanBoard component. Persist preference in localStorage. Both views share same data query.",
    priority: 85,
    sortOrder: 2,
    files: ["ui/src/pages/Issues.tsx"],
    tests: ["Toggle switches between list and board", "Board view renders KanbanBoard", "Dragging card in board updates issue status via API", "View preference persists on reload"],
    dependsOn: ["KanbanBoard component with drag-and-drop"],
  },
  {
    phase: "P2-kanban",
    category: "ui-component",
    title: "FilterBar component for Issues",
    description: "Reusable filter bar with dropdowns for status, priority, project, assignee. Search input with debounce. Filters update URL query params.",
    priority: 70,
    sortOrder: 3,
    files: ["ui/src/components/FilterBar.tsx", "ui/src/pages/Issues.tsx"],
    tests: ["Status filter narrows displayed issues", "Search debounces and filters", "Clear button resets all filters"],
    dependsOn: [],
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Spoke Git Workflow
  // ═══════════════════════════════════════════════════════════════════
  {
    phase: "P3-spoke-git",
    category: "service",
    title: "Spoke tasks service",
    description: "Create server/src/services/spoke-tasks.ts with CRUD for spoke_tasks table. Methods: createTask, listTasks (by company, device, status), getTask, updateTaskStatus (pending→assigned→in_progress→pr_raised→merged→done), assignTask (links device + creates branch name).",
    priority: 90,
    sortOrder: 1,
    files: ["server/src/services/spoke-tasks.ts"],
    tests: ["createTask inserts row", "listTasks filters by device", "updateTaskStatus transitions correctly", "Invalid status transition throws error"],
    dependsOn: [],
  },
  {
    phase: "P3-spoke-git",
    category: "service",
    title: "Pull requests service",
    description: "Create server/src/services/pull-requests.ts with CRUD. Methods: createPR, listPRs (by company, status, device), getPR, reviewPR (approve/reject), mergePR (runs git merge on hub, updates status).",
    priority: 85,
    sortOrder: 2,
    files: ["server/src/services/pull-requests.ts"],
    tests: ["createPR links to spoke_task", "reviewPR sets review_status", "mergePR sets merged_at timestamp", "listPRs filters by status"],
    dependsOn: [],
  },
  {
    phase: "P3-spoke-git",
    category: "api",
    title: "Spoke tasks API routes",
    description: "Create routes: GET /api/companies/:id/spoke-tasks, POST (create+assign), PATCH /:taskId/status, GET /:taskId. Also extend /api/spoke/:deviceId/tasks to include spoke_tasks alongside issues.",
    priority: 80,
    sortOrder: 3,
    files: [
      "server/src/routes/spoke-tasks.ts",
      "server/src/routes/spoke.ts",
      "server/src/app.ts",
    ],
    tests: ["POST creates task and returns it", "PATCH updates status", "GET by device returns assigned tasks", "Spoke endpoint includes spoke_tasks"],
    dependsOn: ["Spoke tasks service"],
  },
  {
    phase: "P3-spoke-git",
    category: "api",
    title: "Pull requests API routes",
    description: "Create routes: GET /api/companies/:id/pull-requests, POST (spoke submits PR), PATCH /:prId/review (approve/reject), POST /:prId/merge. GET /:prId for detail with diff.",
    priority: 80,
    sortOrder: 4,
    files: [
      "server/src/routes/pull-requests.ts",
      "server/src/app.ts",
    ],
    tests: ["POST creates PR", "PATCH review sets status", "POST merge updates merged_at", "GET lists with filters"],
    dependsOn: ["Pull requests service"],
  },
  {
    phase: "P3-spoke-git",
    category: "ui-api",
    title: "UI API clients for spoke-tasks and pull-requests",
    description: "Create ui/src/api/spoke-tasks.ts and ui/src/api/pull-requests.ts with TanStack Query hooks: useSpokeTasks, useSpokeTask, useCreateSpokeTask, useUpdateSpokeTaskStatus, usePullRequests, usePullRequest, useReviewPR, useMergePR.",
    priority: 75,
    sortOrder: 5,
    files: [
      "ui/src/api/spoke-tasks.ts",
      "ui/src/api/pull-requests.ts",
      "ui/src/lib/types.ts",
    ],
    tests: ["Hooks fetch data correctly", "Mutations invalidate queries on success"],
    dependsOn: ["Spoke tasks API routes", "Pull requests API routes"],
  },
  {
    phase: "P3-spoke-git",
    category: "ui-page",
    title: "Spoke Tasks page",
    description: "New page at /spoke-tasks showing all spoke tasks in a table/kanban. Columns: title, device, status, branch, created. Filter by status, device. Button to create new task (assign to device). Status badge colors per workflow state.",
    priority: 70,
    sortOrder: 6,
    files: [
      "ui/src/pages/SpokeTasks.tsx",
      "ui/src/App.tsx",
      "ui/src/components/Layout.tsx",
    ],
    tests: ["Page renders task list", "Filter by status works", "Create task dialog opens", "Status badges show correct colors"],
    dependsOn: ["UI API clients for spoke-tasks and pull-requests", "Add Goals, Spokes, PRs nav items to sidebar"],
  },
  {
    phase: "P3-spoke-git",
    category: "ui-page",
    title: "Pull Requests page",
    description: "New page at /pull-requests showing all PRs. Table with: title, source branch, target branch, device, status, review_status. Approve/Reject/Merge action buttons. Diff viewer for PR detail (expandable or separate page).",
    priority: 70,
    sortOrder: 7,
    files: [
      "ui/src/pages/PullRequests.tsx",
      "ui/src/App.tsx",
    ],
    tests: ["Page renders PR list", "Approve button calls review API", "Merge button calls merge API", "Status badges correct"],
    dependsOn: ["UI API clients for spoke-tasks and pull-requests", "Add Goals, Spokes, PRs nav items to sidebar"],
  },
  {
    phase: "P3-spoke-git",
    category: "ui-page",
    title: "Enhanced SpokeView with git workflow",
    description: "Extend existing SpokeView to show spoke_tasks assigned to this device. Show current branch, worktree status, task progress. Add button to submit PR from spoke view.",
    priority: 65,
    sortOrder: 8,
    files: ["ui/src/pages/SpokeView.tsx"],
    tests: ["Spoke tasks section renders", "Submit PR button creates PR", "Task status updates in real-time"],
    dependsOn: ["UI API clients for spoke-tasks and pull-requests"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4: Dashboard Charts + Inbox
  // ═══════════════════════════════════════════════════════════════════
  {
    phase: "P4-dashboard",
    category: "ui-component",
    title: "ActivityCharts component",
    description: "Port Paperclip ActivityCharts: RunActivityChart (bar chart of runs over time), PriorityChart (donut), IssueStatusChart (donut), SuccessRateChart (gauge). Use lightweight charting (recharts or custom SVG).",
    priority: 60,
    sortOrder: 1,
    files: ["ui/src/components/ActivityCharts.tsx"],
    tests: ["Charts render with mock data", "Empty state shows placeholder"],
    dependsOn: [],
  },
  {
    phase: "P4-dashboard",
    category: "ui-page",
    title: "Dashboard charts section",
    description: "Add charts row to Dashboard below activity feed. Show run activity, issue status distribution, priority breakdown. Responsive grid layout.",
    priority: 55,
    sortOrder: 2,
    files: ["ui/src/pages/Dashboard.tsx"],
    tests: ["Charts section renders", "Responsive layout adjusts"],
    dependsOn: ["ActivityCharts component"],
  },
  {
    phase: "P4-dashboard",
    category: "ui-page",
    title: "Inbox page",
    description: "New page at /inbox showing actionable items: pending approvals, failed heartbeat runs, stale issues (no update >24h), spoke PRs awaiting review. Tabs: New | All. Dismissable items stored in localStorage.",
    priority: 50,
    sortOrder: 3,
    files: [
      "ui/src/pages/Inbox.tsx",
      "ui/src/App.tsx",
      "ui/src/components/Layout.tsx",
    ],
    tests: ["Pending approvals section renders", "Failed runs section renders", "Dismiss persists in localStorage", "Tab switch works"],
    dependsOn: ["Add Goals, Spokes, PRs nav items to sidebar"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 5: Org Chart + Goals + Command Palette
  // ═══════════════════════════════════════════════════════════════════
  {
    phase: "P5-polish",
    category: "ui-page",
    title: "OrgChart page",
    description: "New page at /org showing agent reporting hierarchy as a tree. Canvas-based layout with cards per agent (name, role, status). Lines connecting reports_to relationships. Clickable cards navigate to agent detail.",
    priority: 45,
    sortOrder: 1,
    files: [
      "ui/src/pages/OrgChart.tsx",
      "ui/src/App.tsx",
    ],
    tests: ["Tree renders agents", "Lines connect parent-child", "Click navigates to agent"],
    dependsOn: [],
  },
  {
    phase: "P5-polish",
    category: "ui-page",
    title: "Goals page with GoalTree",
    description: "Enhance Goals page with a hierarchical tree view (parent_id nesting). Show goal title, status, linked issues count. Expandable/collapsible nodes. New Goal dialog.",
    priority: 40,
    sortOrder: 2,
    files: [
      "ui/src/pages/Goals.tsx",
      "ui/src/components/GoalTree.tsx",
    ],
    tests: ["Goal tree renders hierarchy", "Expand/collapse works", "New Goal dialog creates goal"],
    dependsOn: [],
  },
  {
    phase: "P5-polish",
    category: "ui-component",
    title: "CommandPalette (Cmd+K)",
    description: "Global command palette triggered by Cmd+K. Search across agents, issues, projects, goals. Quick actions: create issue, navigate to page. Uses Radix Dialog + cmdk or custom implementation.",
    priority: 35,
    sortOrder: 3,
    files: ["ui/src/components/CommandPalette.tsx", "ui/src/App.tsx"],
    tests: ["Cmd+K opens palette", "Search filters entities", "Select navigates to entity", "Escape closes"],
    dependsOn: [],
  },
  {
    phase: "P5-polish",
    category: "ui-component",
    title: "BreadcrumbBar component",
    description: "Context-aware breadcrumb navigation bar. Shows path like Dashboard > Agents > Agent Name. Auto-derived from route + page data.",
    priority: 30,
    sortOrder: 4,
    files: [
      "ui/src/components/BreadcrumbBar.tsx",
      "ui/src/context/BreadcrumbContext.tsx",
      "ui/src/components/Layout.tsx",
    ],
    tests: ["Breadcrumbs render for nested routes", "Click navigates back"],
    dependsOn: [],
  },
  {
    phase: "P5-polish",
    category: "ui-page",
    title: "Projects detail page with issue listing",
    description: "Enhance ProjectDetail page to show project info, issue list filtered by project, and Kanban view toggle. Show issue counts by status.",
    priority: 30,
    sortOrder: 5,
    files: ["ui/src/pages/ProjectDetail.tsx", "ui/src/App.tsx"],
    tests: ["Project info renders", "Issues filtered by project", "Kanban toggle works"],
    dependsOn: ["KanbanBoard component with drag-and-drop"],
  },
  {
    phase: "P5-polish",
    category: "ui-page",
    title: "ApprovalDetail page",
    description: "New page at /approvals/:id showing full approval detail: requester agent, request payload viewer, approve/reject buttons, resolution history.",
    priority: 25,
    sortOrder: 6,
    files: ["ui/src/pages/ApprovalDetail.tsx", "ui/src/App.tsx"],
    tests: ["Approval detail renders", "Approve/reject buttons work", "Payload viewer shows JSON"],
    dependsOn: [],
  },
];

// ────────────────────────────────────────────────────────────────────

async function post(body: Record<string, unknown>) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  // We don't have POST on the route yet, use the service directly
  // Instead, we'll use a raw SQL approach via a temporary endpoint
  return res;
}

async function seed() {
  console.log("Seeding enhancements...\n");

  // First check if already seeded
  const check = await fetch(`${API}?status=pending`);
  const existing = await check.json();
  if (existing.count > 0) {
    console.log(`Already have ${existing.count} enhancements. Skipping seed.`);
    console.log("To re-seed, run: curl -X DELETE http://localhost:3001/api/enhancements/all");
    return;
  }

  const titleToId = new Map<string, string>();

  // Flatten tasks (parent + children)
  const allTasks: (TaskDef & { parentTitle?: string })[] = [];
  for (const task of PLAN) {
    allTasks.push(task);
    if (task.children) {
      for (const child of task.children) {
        allTasks.push({ ...child, parentTitle: task.title });
      }
    }
  }

  // Create all tasks via raw SQL through the health endpoint hack
  // Actually, let's just use the existing endpoint pattern
  for (const task of allTasks) {
    const parentId = task.parentTitle ? titleToId.get(task.parentTitle) : undefined;

    const body = {
      parentId: parentId ?? null,
      phase: task.phase,
      category: task.category,
      title: task.title,
      description: task.description,
      priority: task.priority,
      sortOrder: task.sortOrder,
      files: task.files,
      tests: task.tests,
      dependsOn: task.dependsOn.map((dep) => titleToId.get(dep)).filter(Boolean),
    };

    // Use the create endpoint - we need to add POST to the route
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to create: ${task.title}`, text);
      continue;
    }

    const json = await res.json();
    titleToId.set(task.title, json.data.id);
    console.log(`  ✓ ${task.phase} | ${task.title}`);
  }

  console.log(`\nSeeded ${titleToId.size} enhancements.`);

  // Print stats
  const stats = await fetch(`${API}/stats`);
  console.log("\nStats:", await stats.json());
}

seed().catch(console.error);
