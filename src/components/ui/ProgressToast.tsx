import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";

export const ProgressToast = ({ message }: { message: string }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 95) {
                    clearInterval(timer);
                    // Stop at 95% and wait for final completion
                    return 95;
                }
                // Slow down progress as it gets closer to 95%
                const increment = Math.max(1, (100 - prev) / 15);
                return Math.min(95, prev + increment);
            });
        }, 50);

        // Force complete after 2 seconds (typical chart load time)
        const completeTimer = setTimeout(() => {
            setProgress(100);
        }, 2000);

        return () => {
            clearInterval(timer);
            clearTimeout(completeTimer);
        };
    }, []);

    return (
        <div className="w-full space-y-2">
            <p>{message}</p>
            <Progress value={progress} className="w-full h-2" />
        </div>
    );
};