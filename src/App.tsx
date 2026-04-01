import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Learn from "./pages/Learn";
import ModuleView from "./pages/ModuleView";
import CollectionDetail from "./pages/CollectionDetail";
import Grow from "./pages/Grow";
import People from "./pages/People";
import Settings from "./pages/Settings";
import Home from "./pages/Home";
import Tools from "./pages/Tools";
import AskKlaaryo from "./pages/AskKlaaryo";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ImpersonationProvider>
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Navigate to="/home" replace />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <AppLayout><Home /></AppLayout>
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
                path="/learn/:curriculumId"
                element={
                  <ProtectedRoute>
                    <AppLayout><CollectionDetail /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/learn/:moduleId/view"
                element={
                  <ProtectedRoute>
                    <AppLayout><ModuleView /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tools"
                element={
                  <ProtectedRoute>
                    <AppLayout><Tools /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ask"
                element={
                  <ProtectedRoute>
                    <AppLayout><AskKlaaryo /></AppLayout>
                  </ProtectedRoute>
                }
              <Route
                path="/grow"
                element={
                  <ProtectedRoute>
                    <AppLayout><Grow /></AppLayout>
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
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <AppLayout><Settings /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
          <ChatAgentWidget />
          </ImpersonationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
