"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ListFilter, Download, Loader2, Eye } from "lucide-react"; // Added Eye
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { useState, useEffect, useMemo } from "react";
import { getActivityLog, type ActivityLogItem } from "@/lib/activityLog";
import { IconRenderer } from "../../page";
import Link from "next/link"; // Added Link

export default function AuditLogsPage() {
  const router = useRouter();
  const [auditLog, setAuditLog] = useState<ActivityLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchLog = async () => {
      setIsLoading(true);
      try {
        const log = await getActivityLog();
        setAuditLog(log.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      } catch (error) {
        console.error("Failed to load audit log:", error);
      }
      setIsLoading(false);
    };
    fetchLog();
  }, []);

  const filteredLogs = useMemo(() => {
    if (!searchTerm) return auditLog;
    return auditLog.filter(log =>
      log.actorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actionDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.targetEntityType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.targetEntityId?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [auditLog, searchTerm]);


  const handleExportLogs = () => {
    if (filteredLogs.length === 0) {
      alert("No logs to export.");
      return;
    }
    const headers = ["Timestamp", "Actor", "Role", "Action", "Target Type", "Target ID", "Details"];
    const csvContent = [
      headers.join(","),
      ...filteredLogs.map(log => [
        `"${format(parseISO(log.timestamp), "yyyy-MM-dd HH:mm:ss")}"`,
        `"${log.actorName}"`,
        `"${log.actorRole}"`,
        `"${log.actionDescription.replace(/"/g, '""')}"`,
        `"${log.targetEntityType || ''}"`,
        `"${log.targetEntityId || ''}"`,
        `"${(log.details || '').replace(/"/g, '""')}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `navael_audit_log_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading && auditLog.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <ShieldCheck className="mr-3 h-8 w-8 text-primary" /> Audit Logs
          </h1>
          <p className="text-muted-foreground">Review system activity, changes, and access records.</p>
        </div>
         <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin Panel
            </Button>
             <Button onClick={handleExportLogs} disabled={filteredLogs.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Export Filtered Logs
            </Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">System Event Log</CardTitle>
          <CardDescription>
            Detailed log of actions performed within the system.
          </CardDescription>
          <Input
            placeholder="Search logs by user, action, details, target type, or target ID..."
            className="mt-2 max-w-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          {isLoading && filteredLogs.length === 0 ? (
             <div className="flex items-center justify-center min-h-[300px]">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Filtering logs...</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Icon</TableHead>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                   <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell><IconRenderer iconName={log.iconName} /></TableCell>
                    <TableCell>
                        {format(parseISO(log.timestamp), "PPP p")}
                        <br/>
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(log.timestamp), { addSuffix: true })}</span>
                    </TableCell>
                    <TableCell>{log.actorName} <span className="text-xs text-muted-foreground">({log.actorRole})</span></TableCell>
                    <TableCell>{log.actionDescription}</TableCell>
                    <TableCell>
                      {log.targetEntityType && (
                        <span>{log.targetEntityType}: {log.targetEntityId}</span>
                      )}
                      {!log.targetEntityType && "N/A"}
                    </TableCell>
                    <TableCell className="text-xs max-w-xs break-words">{log.details || "---"}</TableCell>
                    <TableCell className="text-right">
                      {log.targetLink ? (
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={log.targetLink} title="View Target Entity">
                            <Eye className="h-4 w-4 text-primary" />
                          </Link>
                        </Button>
                      ) : "---"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="min-h-[300px] flex flex-col items-center justify-center bg-muted/30 rounded-md p-6 text-center">
              <ShieldCheck className="h-24 w-24 text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">
                {auditLog.length === 0 ? "No Audit Logs Available" : "No logs match your search criteria."}
              </p>
              <p className="text-sm text-muted-foreground">
                System activity will be logged here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
