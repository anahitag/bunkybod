"use client";

import { Button } from "@/components/ui/button";
import { Upload, Loader2, Plus } from "lucide-react";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  action?: "upload" | "add" | "none";
  actionLabel?: string;
  onAction?: () => void;
  onFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileAccept?: string;
  loading?: boolean;
  children?: ReactNode; // for time range tabs
}

export function PageHeader({
  title,
  action = "none",
  actionLabel,
  onAction,
  onFileUpload,
  fileAccept = ".pdf,.xml,.zip",
  loading = false,
  children,
}: PageHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          {children}
          {action === "upload" && onFileUpload && (
            <label className="cursor-pointer">
              <Button size="sm" asChild disabled={loading}>
                <span>
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                  {actionLabel || "Import"}
                </span>
              </Button>
              <input type="file" accept={fileAccept} className="hidden" onChange={onFileUpload} disabled={loading} />
            </label>
          )}
          {action === "add" && onAction && (
            <Button size="sm" onClick={onAction} disabled={loading}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {actionLabel || "Add"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
