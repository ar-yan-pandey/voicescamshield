import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roomName, setRoomName] = useState("");

  const startCall = () => {
    setDialogOpen(true);
  };

  const handleJoin = (e?: React.FormEvent) => {
    e?.preventDefault?.();
    const name = roomName.trim();
    if (!name) return;
    navigate(`/call/${encodeURIComponent(name)}`);
    setDialogOpen(false);
  };
  return (
    <main className="min-h-screen grid place-items-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-primary opacity-20 pointer-events-none" />
      <section className="container relative py-24 text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">Voice Scam Shield</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Real-time scam call detection with WebRTC and AI. Live transcripts, deepfake checks, and a clear risk score to keep you safe.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button onClick={startCall} className="shadow-glow transition-smooth">Start a Call</Button>
          <a href="/community" className="inline-flex">
            <Button variant="secondary">Community List</Button>
          </a>
          <a href="/download-app" className="inline-flex" aria-label="Download Scam Shield overlay app">
            <Button variant="outline">Download App</Button>
          </a>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Choose a room name</DialogTitle>
              <DialogDescription>
                We’ll use this as the call ID so you can share it.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="text-left space-y-2">
                <Label htmlFor="room-name">Room name</Label>
                <Input
                  id="room-name"
                  placeholder="e.g., Family Call"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Start Call</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>
    </main>
  );
};

export default Index;
