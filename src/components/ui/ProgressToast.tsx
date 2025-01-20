import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";

export const ProgressToast = ({ message }: { message: string }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(timer);
                    return 100;
                }
                return prev + 1;
            });
        }, 20);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="w-full space-y-2">
            <p>{message}</p>
            <Progress value={progress} className="w-full h-2" />
        </div>
    );
}; 