import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const startCall = () => {
    const id = Date.now().toString(36);
    navigate(`/call/${id}`);
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
        </div>
      </section>
    </main>
  );
};

export default Index;
