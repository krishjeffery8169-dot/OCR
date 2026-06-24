import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import DatasetPage from "@/pages/DatasetPage";
import LoginPage from "@/pages/LoginPage";
import ModelCropPage from "@/pages/ModelCropPage";
import SystemPage from "@/pages/SystemPage";
import TasksPage from "@/pages/TasksPage";
import { usePlatformStore } from "@/store/usePlatformStore";

function ProtectedRoute() {
  const token = usePlatformStore((state) => state.token);
  return token ? <AppShell /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/model-crop" replace />} />
        <Route path="/model-crop" element={<ModelCropPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/crawl" element={<TasksPage />} />
          <Route path="/results" element={<DatasetPage />} />
          <Route path="/sources" element={<SystemPage />} />
          <Route path="/tasks" element={<Navigate to="/crawl" replace />} />
          <Route path="/dataset" element={<Navigate to="/results" replace />} />
          <Route path="/system" element={<Navigate to="/sources" replace />} />
          <Route path="*" element={<Navigate to="/crawl" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
