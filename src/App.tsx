import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Learn from "./pages/Learn";
import ModuleView from "./pages/ModuleView";
import CurriculumDetail from "./pages/CurriculumDetail";
import Grow from "./pages/Grow";
import Perform from "./pages/Perform";
import People from "./pages/People";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Navigate to="/learn" replace />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/learn"
              element={
                <ProtectedRoute>
                  <AppLayout><Learn /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/learn/:moduleId"
              element={
                <ProtectedRoute>
                  <AppLayout><ModuleView /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/grow"
              element={
                <ProtectedRoute>
                  <AppLayout><Grow /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/perform"
              element={
                <ProtectedRoute>
                  <AppLayout><Perform /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/people"
              element={
                <ProtectedRoute>
                  <AppLayout><People /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
