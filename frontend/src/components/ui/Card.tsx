import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "glass";
}

const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = "default", children, ...props }, ref) => {
        const variants = {
            default: "bg-app-card border border-app-border",
            glass: "bg-app-card/50 backdrop-blur-xl border border-app-border/50",
        };

        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-xl p-4",
                    variants[variant],
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = "Card";
export { Card };
