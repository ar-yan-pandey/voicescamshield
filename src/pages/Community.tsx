import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const sample = [
  { name: "Unknown Caller", phone: "+1 (555) 013-7788", notes: "Claims to be from 'bank security'" },
  { name: "Tech Support", phone: "+44 20 7946 0958", notes: "Asks to install remote desktop" },
  { name: "Lottery Center", phone: "+61 2 9374 4000", notes: "Upfront fee to claim prize" },
];

// Demo: Long list of reported phone numbers (generated)
const reportedNumbersSeed: string[] = Array.from({ length: 200 }, (_, i) => {
  const n = (1000000 + i).toString();
  return `+1 (555) ${n.slice(0, 3)}-${n.slice(3)}`;
});

const Community: React.FC = () => {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [scammers, setScammers] = useState(sample);
  const [numbers, setNumbers] = useState(reportedNumbersSeed);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });

  useEffect(() => {
    // Basic SEO for SPA route
    document.title = "Community Scammer List | Scam Shield";
    const descContent = "Search and report known scam callers to help protect the community.";
    let desc = document.querySelector('meta[name="description"]');
    if (!desc) {
      desc = document.createElement("meta");
      desc.setAttribute("name", "description");
      document.head.appendChild(desc);
    }
    desc.setAttribute("content", descContent);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", window.location.href);
  }, []);

  const filteredScammers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scammers;
    return scammers.filter((s) =>
      [s.name, s.phone, s.notes].some((v) => v.toLowerCase().includes(q))
    );
  }, [scammers, search]);

  const filteredNumbers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return numbers;
    return numbers.filter((n) => n.toLowerCase().includes(q));
  }, [numbers, search]);

  const onSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, phone, notes } = form;
    if (!name && !phone) {
      toast({ title: "Missing info", description: "Please enter a name or phone number.", variant: "destructive" });
      return;
    }
    if (name || phone || notes) {
      setScammers((prev) => [{ name: name || "Unknown", phone: phone || "N/A", notes: notes || "" }, ...prev]);
      if (phone) setNumbers((prev) => [phone, ...prev]);
      setForm({ name: "", phone: "", notes: "" });
      setOpen(false);
      toast({ title: "Reported", description: "Thanks for helping the community." });
    }
  };

  return (
    <main className="min-h-screen container py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Community Scammer List</h1>
        <p className="text-muted-foreground mt-1">Browse, search, and report known scammers to help protect others.</p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-md">
            <Label htmlFor="search" className="sr-only">Search</Label>
            <Input
              id="search"
              placeholder="Search by name, phone, or notes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Report a Number</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report a Suspicious Caller</DialogTitle>
                <DialogDescription>Share details to help the community stay safe.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmitReport} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name (if known)</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" placeholder="e.g. +1 (555) 123-4567" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" placeholder="Describe what happened" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Report</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
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
                {filteredScammers.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.phone}</TableCell>
                    <TableCell>{row.notes}</TableCell>
                  </TableRow>
                ))}
                {filteredScammers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No results.</TableCell>
                  </TableRow>
                )}
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
              {filteredNumbers.map((num, i) => (
                <li key={i} className="text-sm font-mono px-3 py-2 rounded bg-secondary text-secondary-foreground">
                  {num}
                </li>
              ))}
              {filteredNumbers.length === 0 && (
                <li className="text-sm text-muted-foreground">No numbers found.</li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Community;
