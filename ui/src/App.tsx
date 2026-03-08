import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./context/ThemeContext";
import { CompanyProvider } from "./context/CompanyContext";
import { Layout } from "./components/Layout";

// Pages (lazy would be ideal for prod, but direct imports for clarity)
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import AgentDetail from "./pages/AgentDetail";
import Issues from "./pages/Issues";
import IssueDetail from "./pages/IssueDetail";
import EdgeMesh from "./pages/EdgeMesh";
import Costs from "./pages/Costs";
import Approvals from "./pages/Approvals";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";
import SpokeView from "./pages/SpokeView";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <CompanyProvider>
            <Routes>
              {/* Spoke view — standalone thin-client page (no sidebar/layout) */}
              <Route path="spoke/:deviceId" element={<SpokeView />} />

              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="agents" element={<Agents />} />
                <Route path="agents/:id" element={<AgentDetail />} />
                <Route path="issues" element={<Issues />} />
                <Route path="issues/:id" element={<IssueDetail />} />
                <Route path="edge-mesh" element={<EdgeMesh />} />
                <Route path="costs" element={<Costs />} />
                <Route path="approvals" element={<Approvals />} />
                <Route path="activity" element={<Activity />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </CompanyProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
