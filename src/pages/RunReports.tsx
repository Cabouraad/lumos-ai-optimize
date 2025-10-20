import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function RunReports() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const runReports = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("generate-weekly-report", {
          body: {}
        });

        if (error) throw error;

        setStatus("success");
        setMessage(data?.message || "Reports generated successfully!");
        
        // Redirect to reports page after 2 seconds
        setTimeout(() => {
          navigate("/reports");
        }, 2000);
      } catch (error) {
        console.error("Error generating reports:", error);
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Failed to generate reports");
      }
    };

    runReports();
  }, [navigate]);

  return (
    <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
      <Card className="p-8 max-w-md w-full">
        <div className="flex flex-col items-center gap-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h2 className="text-xl font-semibold">Generating Weekly Reports...</h2>
              <p className="text-muted-foreground text-center">
                This may take a few moments
              </p>
            </>
          )}
          
          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h2 className="text-xl font-semibold">Success!</h2>
              <p className="text-muted-foreground text-center">{message}</p>
              <p className="text-sm text-muted-foreground">Redirecting to reports...</p>
            </>
          )}
          
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-red-500" />
              <h2 className="text-xl font-semibold">Error</h2>
              <p className="text-muted-foreground text-center">{message}</p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
