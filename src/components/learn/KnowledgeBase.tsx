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
          Upload documents and create FAQs to feed AI module generation.
        </p>
      </div>

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
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
