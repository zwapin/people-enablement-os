import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DocumentsList from "./DocumentsList";
import FaqList from "./FaqList";

export default function KnowledgeBase() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Carica documenti e crea FAQ per alimentare la generazione dei moduli AI.
        </p>
      </div>

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents">Documenti</TabsTrigger>
          <TabsTrigger value="faqs">FAQ</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <DocumentsList />
        </TabsContent>

        <TabsContent value="faqs">
          <FaqList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
