import { cn } from "@/lib/utils"

interface BrandNameProps {
  questionMark?: boolean
  className?: string
}

export function BrandName({ questionMark = false, className }: BrandNameProps) {
  return (
    <span className={cn("font-brand", className)}>
      Bila UiTM Cuti{questionMark ? "?" : ""}
    </span>
  )
}
