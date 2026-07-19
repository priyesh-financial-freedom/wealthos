import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={cn("flex w-full min-w-0 flex-col gap-6 lg:gap-8", className)}>{children}</div>;
}
