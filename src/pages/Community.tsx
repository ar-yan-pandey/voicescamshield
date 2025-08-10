import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const sample = [
  { name: "Unknown Caller", phone: "+1 (555) 013-7788", notes: "Claims to be from 'bank security'" },
  { name: "Tech Support", phone: "+44 20 7946 0958", notes: "Asks to install remote desktop" },
  { name: "Lottery Center", phone: "+61 2 9374 4000", notes: "Upfront fee to claim prize" },
];

// Demo: Long list of reported phone numbers (generated)
const reportedNumbers: string[] = Array.from({ length: 200 }, (_, i) => {
  const n = (1000000 + i).toString();
  return `+1 (555) ${n.slice(0, 3)}-${n.slice(3)}`;
});

const Community: React.FC = () => {
  return (
    <main className="min-h-screen container py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Community Scammer List</h1>
        <p className="text-muted-foreground mt-1">Browse and report known scammers to help protect others.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Reported Scammers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sample.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.phone}</TableCell>
                    <TableCell>{row.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Reported Phone Numbers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto rounded-md border bg-card/50 p-3">
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {reportedNumbers.map((num, i) => (
                <li key={i} className="text-sm font-mono px-3 py-2 rounded bg-secondary text-secondary-foreground">
                  {num}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Community;
